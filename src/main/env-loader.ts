/**
 * Environment Variable Loader
 *
 * Loads .env file for the main process.
 * This file must be imported BEFORE any other imports that use environment variables.
 */

import dotenv from 'dotenv';

// Load .env file
dotenv.config();

console.log('Environment variables loaded from .env file');
