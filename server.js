import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import compression from 'compression';
import pg from 'pg';
import { spawn } from 'child_process';
const { Client } = pg;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;

// Enable gzip compression
app.use(compression());
app.use(express.json());

// CORS middleware for development
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    if (req.method === 'OPTIONS') {
      return res.sendStatus(200);
    }
    next();
  });
}

// Database connection management
let dbClient = null;
let isConnected = false;
let connectionRetries = 0;
const MAX_RETRIES = process.env.DB_MAX_RETRIES ? parseInt(process.env.DB_MAX_RETRIES, 10) : 5;
const RETRY_DELAY = process.env.DB_RETRY_DELAY ? parseInt(process.env.DB_RETRY_DELAY, 10) : 5000;

const createClient = () => {
  if (!process.env.AZURE_POSTGRESQL_CONNECTIONSTRING) {
    throw new Error('AZURE_POSTGRESQL_CONNECTIONSTRING environment variable is not set');
  }

  return new Client({
    connectionString: process.env.AZURE_POSTGRESQL_CONNECTIONSTRING,
    ssl: {
      rejectUnauthorized: false
    }
  });
};

const connectDB = async () => {
  if (isConnected) return true;

  try {
    if (dbClient) {
      await dbClient.end().catch(() => {});
    }

    console.log('Creating new database client...');
    dbClient = createClient();
    
    console.log('Connecting to database...');
    await dbClient.connect();
    
    console.log('Testing connection...');
    await dbClient.query('SELECT 1');
    
    console.log('Database connection successful');
    isConnected = true;
    connectionRetries = 0;

    // Run database initialization
    console.log('Running database initialization...');
    const initScript = spawn('node', ['scripts/init-db.js'], {
      stdio: 'inherit',
      env: process.env
    });

    await new Promise((resolve, reject) => {
      initScript.on('close', (code) => {
        if (code === 0) {
          console.log('Database initialization completed successfully');
          resolve();
        } else {
          console.error(`Database initialization failed with code ${code}`);
          reject(new Error(`Database initialization failed with code ${code}`));
        }
      });
    });

    return true;
  } catch (error) {
    console.error('Database connection error:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    
    isConnected = false;
    dbClient = null;

    if (connectionRetries < MAX_RETRIES) {
      connectionRetries++;
      console.log(`Retrying connection (${connectionRetries}/${MAX_RETRIES}) in ${RETRY_DELAY}ms...`);
      await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
      return connectDB();
    }
    return false;
  }
};

// Health check endpoint
app.get('/api/health', async (req, res) => {
  try {
    const health = {
      status: 'healthy',
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      database: isConnected ? 'connected' : 'disconnected',
      environment: {
        nodeEnv: process.env.NODE_ENV,
        hasConnectionString: !!process.env.AZURE_POSTGRESQL_CONNECTIONSTRING
      }
    };

    if (isConnected) {
      try {
        await dbClient.query('SELECT 1');
        health.database = 'connected';
      } catch (dbError) {
        console.error('Database health check failed:', dbError);
        health.database = 'error';
        health.databaseError = dbError.message;
        
        // Attempt to reconnect in the background
        connectDB().catch(error => {
          console.error('Reconnection attempt failed:', error);
        });
      }
    } else {
      // Attempt to connect if not connected
      const connected = await connectDB();
      health.database = connected ? 'connected' : 'disconnected';
    }

    const statusCode = health.database === 'connected' ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

// Database query endpoint
app.post('/api/query', async (req, res) => {
  if (!isConnected) {
    console.log('Database not connected, attempting to connect...');
    const connected = await connectDB();
    if (!connected) {
      return res.status(503).json({
        error: true,
        message: 'Database not connected'
      });
    }
  }

  try {
    const { text, params } = req.body;
    
    if (!text) {
      return res.status(400).json({
        error: true,
        message: 'Query text is required'
      });
    }

    console.log('Executing query:', text);
    console.log('Query parameters:', params);

    const result = await dbClient.query(text, params);
    console.log('Query executed successfully');

    res.json({
      rows: result.rows,
      rowCount: result.rowCount,
      fields: result.fields?.map(f => ({
        name: f.name,
        dataType: f.dataTypeID
      }))
    });
  } catch (error) {
    console.error('Query error:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    
    if (error.code === 'ECONNRESET' || error.code === '57P01') {
      isConnected = false;
      connectDB().catch(console.error);
    }
    
    res.status(500).json({ 
      error: true,
      message: error.message,
      code: error.code,
      detail: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

// Serve static files
app.use(express.static(join(__dirname, 'dist')));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, 'dist', 'index.html'));
});

// Graceful shutdown
const shutdown = async () => {
  console.log('Shutting down gracefully...');
  if (dbClient) {
    try {
      await dbClient.end();
      console.log('Database connection closed');
    } catch (error) {
      console.error('Error closing database connection:', error);
    }
  }
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Initialize server
const startServer = async () => {
  try {
    const server = app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Health check available at: http://localhost:${PORT}/api/health`);
      console.log('Environment:', {
        nodeEnv: process.env.NODE_ENV,
        hasConnectionString: !!process.env.AZURE_POSTGRESQL_CONNECTIONSTRING
      });
    });

    const dbConnected = await connectDB();
    if (!dbConnected) {
      console.log('Server started but database connection failed');
    }

    return server;
  } catch (error) {
    console.error('Failed to start server:', error);
    console.error('Error details:', {
      code: error.code,
      message: error.message,
      stack: error.stack
    });
    process.exit(1);
  }
};

startServer();