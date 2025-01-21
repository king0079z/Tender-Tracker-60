#!/bin/bash

# Wait for any existing deployment to complete
echo "Waiting for any existing deployment to complete..."
sleep 10

# Run database initialization
echo "Initializing database..."
node scripts/init-db.js

# Install production dependencies
echo "Installing dependencies..."
npm install --production

# Build the application
echo "Building application..."
npm run build

# Copy necessary files to dist
echo "Preparing distribution..."
cp package*.json dist/
cp server.js dist/
cp web.config dist/

# Install production dependencies in dist
cd dist
npm install --production

# The deployment script will automatically deploy the contents of this directory