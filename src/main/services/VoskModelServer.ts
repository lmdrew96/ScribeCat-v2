/**
 * VoskModelServer
 * 
 * Simple HTTP server to serve Vosk model files locally.
 * This allows vosk-browser to load models without requiring an external HTTP server.
 * 
 * The server runs on localhost and only serves files from the configured model directory.
 */

import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { URL } from 'url';

export class VoskModelServer {
  private server: http.Server | null = null;
  private port: number = 8765; // Default port
  private modelPath: string = '';
  private isRunning: boolean = false;

  /**
   * Start the HTTP server
   * 
   * @param modelPath Path to the directory containing Vosk models
   * @param port Port to run the server on (default: 8765)
   */
  async start(modelPath: string, port: number = 8765): Promise<string> {
    if (this.isRunning) {
      console.log('Vosk model server already running');
      return this.getServerUrl();
    }

    this.modelPath = modelPath;
    this.port = port;

    // Verify model path exists
    if (!fs.existsSync(modelPath)) {
      throw new Error(`Model path does not exist: ${modelPath}`);
    }

    return new Promise((resolve, reject) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res);
      });

      this.server.on('error', (error: NodeJS.ErrnoException) => {
        if (error.code === 'EADDRINUSE') {
          console.error(`Port ${this.port} is already in use`);
          reject(new Error(`Port ${this.port} is already in use. Please close other applications using this port.`));
        } else {
          console.error('Server error:', error);
          reject(error);
        }
      });

      this.server.listen(this.port, 'localhost', () => {
        this.isRunning = true;
        const url = this.getServerUrl();
        console.log(`Vosk model server started at ${url}`);
        console.log(`Serving models from: ${this.modelPath}`);
        resolve(url);
      });
    });
  }

  /**
   * Stop the HTTP server
   */
  async stop(): Promise<void> {
    if (!this.server || !this.isRunning) {
      console.log('Vosk model server not running');
      return;
    }

    return new Promise((resolve, reject) => {
      this.server!.close((error) => {
        if (error) {
          console.error('Error stopping server:', error);
          reject(error);
        } else {
          this.isRunning = false;
          this.server = null;
          console.log('Vosk model server stopped');
          resolve();
        }
      });
    });
  }

  /**
   * Check if server is running
   */
  isServerRunning(): boolean {
    return this.isRunning;
  }

  /**
   * Get the server URL
   */
  getServerUrl(): string {
    return `http://localhost:${this.port}`;
  }

  /**
   * Handle HTTP requests
   */
  private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
    try {
      // Parse URL
      const parsedUrl = new URL(req.url || '/', `http://localhost:${this.port}`);
      let filePath = parsedUrl.pathname;

      // Remove leading slash
      if (filePath.startsWith('/')) {
        filePath = filePath.substring(1);
      }

      // Security: Prevent directory traversal
      if (filePath.includes('..')) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden: Directory traversal not allowed');
        return;
      }

      // Construct full file path
      const fullPath = path.join(this.modelPath, filePath);

      // Check if file exists
      if (!fs.existsSync(fullPath)) {
        res.writeHead(404, { 'Content-Type': 'text/plain' });
        res.end('File not found');
        return;
      }

      // Check if it's a file (not a directory)
      const stats = fs.statSync(fullPath);
      if (!stats.isFile()) {
        res.writeHead(403, { 'Content-Type': 'text/plain' });
        res.end('Forbidden: Not a file');
        return;
      }

      // Determine content type
      const contentType = this.getContentType(fullPath);

      // Enable CORS for vosk-browser
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      // Handle OPTIONS request (CORS preflight)
      if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
      }

      // Read and serve file
      const fileStream = fs.createReadStream(fullPath);
      
      res.writeHead(200, {
        'Content-Type': contentType,
        'Content-Length': stats.size
      });

      fileStream.pipe(res);

      fileStream.on('error', (error) => {
        console.error('Error reading file:', error);
        res.writeHead(500, { 'Content-Type': 'text/plain' });
        res.end('Internal server error');
      });

    } catch (error) {
      console.error('Error handling request:', error);
      res.writeHead(500, { 'Content-Type': 'text/plain' });
      res.end('Internal server error');
    }
  }

  /**
   * Get content type based on file extension
   */
  private getContentType(filePath: string): string {
    const ext = path.extname(filePath).toLowerCase();
    
    const contentTypes: { [key: string]: string } = {
      '.json': 'application/json',
      '.txt': 'text/plain',
      '.bin': 'application/octet-stream',
      '.wasm': 'application/wasm',
      '.js': 'application/javascript',
      '.conf': 'text/plain',
      '.fst': 'application/octet-stream',
      '.zip': 'application/zip'
    };

    return contentTypes[ext] || 'application/octet-stream';
  }
}
