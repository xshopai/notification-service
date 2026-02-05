/**
 * Notification Service - Bootstrap Entry Point
 * Loads environment and starts the consumer application
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Initialize Zipkin tracing FIRST
import './tracing.js';

async function startServer() {
  try {
    // Import and start the application
    const appModule = await import('./app.js');
    await appModule.startConsumer();
  } catch (error) {
    console.error('Failed to start notification service:', error);
    process.exit(1);
  }
}

startServer();
