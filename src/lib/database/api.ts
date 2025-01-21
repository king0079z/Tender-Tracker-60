/**
 * Client-side API wrapper for database operations
 */
export class DatabaseAPI {
  private baseUrl: string;
  private retryCount: number = 0;
  private maxRetries: number = 3;
  private retryDelay: number = 1000;
  private connectionCheckInterval: number = 30000;
  private connectionCheckTimer: number | null = null;
  private connectionListeners: Set<(connected: boolean) => void> = new Set();
  private isConnected: boolean = false;
  private lastHealthCheck: number = 0;
  private healthCheckThrottle: number = 1000; // Minimum time between health checks

  constructor() {
    this.baseUrl = '/api';
    this.startConnectionMonitoring();
  }

  private async retryOperation<T>(operation: () => Promise<T>): Promise<T> {
    try {
      const result = await operation();
      this.retryCount = 0;
      return result;
    } catch (error) {
      if (error instanceof Error && error.message.includes('Failed to fetch')) {
        // Network error - mark as disconnected
        this.setConnectionStatus(false);
        console.error('Network error:', error);
      } else {
        console.error('Operation failed:', error);
      }
      
      if (this.retryCount < this.maxRetries) {
        this.retryCount++;
        const delay = Math.min(this.retryDelay * Math.pow(2, this.retryCount - 1), 10000);
        console.log(`Retrying operation in ${delay}ms (attempt ${this.retryCount}/${this.maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        return this.retryOperation(operation);
      }
      throw error;
    }
  }

  private setConnectionStatus(connected: boolean) {
    if (this.isConnected !== connected) {
      this.isConnected = connected;
      this.notifyListeners(connected);
    }
  }

  private async checkConnection() {
    // Throttle health checks
    const now = Date.now();
    if (now - this.lastHealthCheck < this.healthCheckThrottle) {
      return;
    }
    this.lastHealthCheck = now;

    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Health check failed with status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Consider connected only if both the status is healthy AND database is connected
      const isConnected = data && data.status === 'healthy' && data.database === 'connected';
      this.setConnectionStatus(isConnected);

      if (!isConnected && data.databaseError) {
        console.error('Database health check error:', data.databaseError);
      }
    } catch (error) {
      console.error('Connection check failed:', error instanceof Error ? error.message : 'Unknown error');
      this.setConnectionStatus(false);
    }
  }

  private startConnectionMonitoring() {
    // Initial check
    this.checkConnection();
    
    // Clear any existing timer
    if (this.connectionCheckTimer) {
      window.clearInterval(this.connectionCheckTimer);
    }
    
    // Start periodic checks
    this.connectionCheckTimer = window.setInterval(() => {
      this.checkConnection();
    }, this.connectionCheckInterval);

    // Add online/offline event listeners
    window.addEventListener('online', () => {
      console.log('Network online - checking connection');
      this.checkConnection();
    });

    window.addEventListener('offline', () => {
      console.log('Network offline - marking as disconnected');
      this.setConnectionStatus(false);
    });
  }

  public onConnectionChange(listener: (connected: boolean) => void) {
    this.connectionListeners.add(listener);
    listener(this.isConnected);
    return () => {
      this.connectionListeners.delete(listener);
    };
  }

  private notifyListeners(connected: boolean) {
    this.connectionListeners.forEach(listener => {
      try {
        listener(connected);
      } catch (error) {
        console.error('Error in connection listener:', error);
      }
    });
  }

  public cleanup() {
    if (this.connectionCheckTimer) {
      window.clearInterval(this.connectionCheckTimer);
    }
    this.connectionListeners.clear();
    window.removeEventListener('online', this.checkConnection);
    window.removeEventListener('offline', () => this.setConnectionStatus(false));
  }

  async query(text: string, params?: any[]) {
    return this.retryOperation(async () => {
      // Check connection before making query
      if (!this.isConnected) {
        await this.checkConnection();
        if (!this.isConnected) {
          throw new Error('Database is not connected');
        }
      }

      const response = await fetch(`${this.baseUrl}/query`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ text, params }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.message || `Query failed with status ${response.status}`;
        const error = new Error(errorMessage);
        (error as any).status = response.status;
        (error as any).code = errorData.code;
        throw error;
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.message || 'Database query failed');
      }

      return data;
    });
  }

  async testConnection() {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Health check failed with status: ${response.status}`);
      }

      const data = await response.json();
      const isConnected = data && data.status === 'healthy' && data.database === 'connected';
      this.setConnectionStatus(isConnected);
      
      return {
        isConnected,
        details: data
      };
    } catch (error) {
      this.setConnectionStatus(false);
      console.error('Connection test failed:', error instanceof Error ? error.message : 'Unknown error');
      return {
        isConnected: false,
        details: {
          error: error instanceof Error ? error.message : 'Connection test failed'
        }
      };
    }
  }
}