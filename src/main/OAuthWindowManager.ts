/**
 * OAuthWindowManager
 *
 * Manages OAuth authentication flow with dedicated Electron windows
 * Handles Google OAuth with WebAuthn/passkey support
 *
 * Responsibilities:
 * - OAuth callback server (localhost:3000)
 * - OAuth authentication window (WebAuthn-enabled)
 * - OAuth waiting window (floating helper)
 * - IPC handlers for OAuth flow
 */

import { BrowserWindow, app, ipcMain } from 'electron';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class OAuthWindowManager {
  private oauthCallbackServer: http.Server | null = null;
  private oauthWindow: BrowserWindow | null = null;
  private oauthWaitingWindow: BrowserWindow | null = null;
  private mainWindow: BrowserWindow | null = null;

  constructor(mainWindow: BrowserWindow | null = null) {
    this.mainWindow = mainWindow;
    this.startOAuthCallbackServer();
    this.setupIPCHandlers();
  }

  /**
   * Set the main window reference (used for sending IPC events)
   */
  setMainWindow(mainWindow: BrowserWindow): void {
    this.mainWindow = mainWindow;
  }

  /**
   * Start OAuth callback server for Google OAuth flow
   * Listens on http://localhost:3000/auth/callback
   * Automatically extracts the authorization code and sends it to the main window
   */
  private startOAuthCallbackServer(): void {
    try {
      const callbackHtmlPath = path.join(__dirname, '..', '..', 'oauth-callback.html');

      this.oauthCallbackServer = http.createServer((req, res) => {
        // Only handle /auth/callback requests
        if (req.url && req.url.startsWith('/auth/callback')) {
          // Parse the URL to extract the authorization code
          const fullUrl = `http://localhost:3000${req.url}`;
          const parsedUrl = new URL(fullUrl);
          const code = parsedUrl.searchParams.get('code');
          const error = parsedUrl.searchParams.get('error');
          const errorDescription = parsedUrl.searchParams.get('error_description');

          if (error) {
            console.error('[OAuth] Error:', error, errorDescription);
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
              this.mainWindow.webContents.send('oauth:error', { error, errorDescription });
            }
          } else if (code) {
            console.log('[OAuth] ✓ Authorization code received, sending to app');
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
              this.mainWindow.webContents.send('oauth:code-received', code);
            } else {
              console.warn('[OAuth] Main window not available');
            }
            this.closeOAuthWaitingWindow();
          }

          // Serve the callback HTML file
          fs.readFile(callbackHtmlPath, 'utf8', (err, data) => {
            if (err) {
              console.error('Error reading OAuth callback file:', err);
              res.writeHead(500, { 'Content-Type': 'text/plain' });
              res.end('Internal Server Error');
              return;
            }

            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
          });
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain' });
          res.end('Not Found');
        }
      });

      this.oauthCallbackServer.listen(3000, () => {
        console.log('[OAuth] Callback server listening on http://localhost:3000');
      });

      this.oauthCallbackServer.on('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          console.warn('[OAuth] Port 3000 already in use');
        } else {
          console.error('[OAuth] Server error:', err);
        }
      });
    } catch (error) {
      console.error('Failed to start OAuth callback server:', error);
      // Don't throw - OAuth can still work manually
    }
  }

  /**
   * Open OAuth URL in a dedicated BrowserWindow with WebAuthn support
   * This enables passkey authentication to work properly
   */
  openOAuthWindow(authUrl: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Close existing OAuth window if it exists
      if (this.oauthWindow && !this.oauthWindow.isDestroyed()) {
        this.oauthWindow.close();
      }

      // Create new OAuth window with WebAuthn support
      this.oauthWindow = new BrowserWindow({
        width: 600,
        height: 800,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          webSecurity: true,
          allowRunningInsecureContent: false,
          partition: undefined,
          // Enable experimental WebAuthn support
          enableWebSQL: false,
          v8CacheOptions: 'code',
        },
        title: 'Sign in with Google',
        modal: false,
        parent: this.mainWindow || undefined,
        show: true,
        alwaysOnTop: false
      });

      // Enable ALL permissions for this window (needed for WebAuthn to work)
      this.oauthWindow.webContents.session.setPermissionRequestHandler((webContents, permission, callback) => {
        console.log(`[OAuth] Permission requested: ${permission}`);

        // Allow all permissions for OAuth window (WebAuthn needs this)
        callback(true);
      });

      // Handle select-client-certificate for WebAuthn
      app.on('select-client-certificate', (event, webContents, url, list, callback) => {
        if (this.oauthWindow && webContents === this.oauthWindow.webContents) {
          console.log('[OAuth] Client certificate requested for:', url);
          event.preventDefault();
          if (list.length > 0) {
            callback(list[0]);
          }
        }
      });

      // Add debug logging
      this.oauthWindow.webContents.on('console-message', (_event, level, message) => {
        console.log(`[OAuth Window] ${message}`);
      });

      // Inject WebAuthn debugging script
      this.oauthWindow.webContents.on('did-finish-load', () => {
        this.oauthWindow?.webContents.executeJavaScript(`
          // Log WebAuthn API availability
          console.log('WebAuthn API available:', typeof navigator.credentials !== 'undefined');
          console.log('PublicKeyCredential available:', typeof PublicKeyCredential !== 'undefined');

          if (typeof PublicKeyCredential !== 'undefined') {
            console.log('Platform authenticator available check...');
            PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable()
              .then(available => {
                console.log('Platform authenticator (TouchID) available:', available);
              })
              .catch(err => {
                console.error('Error checking platform authenticator:', err);
              });
          }

          // Intercept navigator.credentials.get to see if it's called
          if (navigator.credentials && navigator.credentials.get) {
            const originalGet = navigator.credentials.get.bind(navigator.credentials);
            navigator.credentials.get = function(...args) {
              console.log('navigator.credentials.get() called with:', args);
              return originalGet(...args)
                .then(result => {
                  console.log('navigator.credentials.get() succeeded:', result);
                  return result;
                })
                .catch(err => {
                  console.error('navigator.credentials.get() failed:', err);
                  throw err;
                });
            };
          }
        `).catch(err => {
          console.error('Failed to inject WebAuthn debug script:', err);
        });
      });

      // Open DevTools in development for debugging
      if (!app.isPackaged) {
        this.oauthWindow.webContents.openDevTools({ mode: 'detach' });
      }

      // Track if we've already resolved/rejected
      let finished = false;

      // Listen for navigation to extract auth code
      this.oauthWindow.webContents.on('will-redirect', (event, url) => {
        const parsedUrl = new URL(url);

        // Check if this is the callback URL
        if (parsedUrl.origin === 'http://localhost:3000' && parsedUrl.pathname === '/auth/callback') {
          // Extract the authorization code
          const code = parsedUrl.searchParams.get('code');

          if (code && !finished) {
            finished = true;
            console.log('✓ OAuth authorization code received');

            // Close the OAuth window
            if (this.oauthWindow && !this.oauthWindow.isDestroyed()) {
              this.oauthWindow.close();
              this.oauthWindow = null;
            }

            // Return the code
            resolve(code);
          }
        }
      });

      // Also listen for did-navigate in case will-redirect doesn't fire
      this.oauthWindow.webContents.on('did-navigate', (event, url) => {
        const parsedUrl = new URL(url);

        if (parsedUrl.origin === 'http://localhost:3000' && parsedUrl.pathname === '/auth/callback') {
          const code = parsedUrl.searchParams.get('code');

          if (code && !finished) {
            finished = true;
            console.log('✓ OAuth authorization code received');

            if (this.oauthWindow && !this.oauthWindow.isDestroyed()) {
              this.oauthWindow.close();
              this.oauthWindow = null;
            }

            resolve(code);
          }
        }
      });

      // Handle window close
      this.oauthWindow.on('closed', () => {
        if (!finished) {
          finished = true;
          this.oauthWindow = null;
          reject(new Error('OAuth window was closed by user'));
        }
      });

      // Handle navigation errors
      this.oauthWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('OAuth window failed to load:', errorDescription);
        if (!finished) {
          finished = true;
          if (this.oauthWindow && !this.oauthWindow.isDestroyed()) {
            this.oauthWindow.close();
            this.oauthWindow = null;
          }
          reject(new Error(`Failed to load OAuth page: ${errorDescription}`));
        }
      });

      // Load the OAuth URL
      this.oauthWindow.loadURL(authUrl);
    });
  }

  /**
   * Create and show floating OAuth waiting window
   * This window stays on top while user signs in via browser
   */
  showOAuthWaitingWindow(): void {
    // Close existing window if it exists
    if (this.oauthWaitingWindow && !this.oauthWaitingWindow.isDestroyed()) {
      this.oauthWaitingWindow.close();
    }

    // Create floating window
    this.oauthWaitingWindow = new BrowserWindow({
      width: 450,
      height: 400,
      resizable: false,
      frame: false,
      alwaysOnTop: true,
      skipTaskbar: false,
      webPreferences: {
        nodeIntegration: true, // Needed for IPC in oauth-waiting.html
        contextIsolation: false,
      },
      transparent: false,
      backgroundColor: '#667eea',
      show: false, // Don't show until ready
    });

    // Load the OAuth waiting HTML
    const waitingHtmlPath = path.join(__dirname, '..', '..', 'oauth-waiting.html');
    this.oauthWaitingWindow.loadFile(waitingHtmlPath);

    // Show when ready
    this.oauthWaitingWindow.once('ready-to-show', () => {
      this.oauthWaitingWindow?.show();
      // Center the window
      this.oauthWaitingWindow?.center();
    });

    // Clean up on close
    this.oauthWaitingWindow.on('closed', () => {
      this.oauthWaitingWindow = null;
    });
  }

  /**
   * Close the OAuth waiting window
   */
  closeOAuthWaitingWindow(): void {
    if (this.oauthWaitingWindow && !this.oauthWaitingWindow.isDestroyed()) {
      this.oauthWaitingWindow.webContents.send('oauth:close');
      setTimeout(() => {
        if (this.oauthWaitingWindow && !this.oauthWaitingWindow.isDestroyed()) {
          this.oauthWaitingWindow.close();
          this.oauthWaitingWindow = null;
        }
      }, 100);
    }
  }

  /**
   * Set up IPC handlers for OAuth flow
   * Called automatically in constructor
   */
  private setupIPCHandlers(): void {
    // OAuth window handler - opens Google OAuth in Electron window with WebAuthn support
    ipcMain.handle('auth:openOAuthWindow', async (_event, authUrl: string) => {
      try {
        console.log('Opening OAuth window with WebAuthn support...');
        const code = await this.openOAuthWindow(authUrl);
        console.log('✓ OAuth completed successfully');
        return { success: true, code };
      } catch (error) {
        console.error('OAuth window error:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // OAuth waiting window handlers
    ipcMain.handle('oauth:showWaitingWindow', async (_event) => {
      try {
        this.showOAuthWaitingWindow();
        return { success: true };
      } catch (error) {
        console.error('Failed to show OAuth waiting window:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    ipcMain.handle('oauth:closeWaitingWindow', async (_event) => {
      try {
        this.closeOAuthWaitingWindow();
        return { success: true };
      } catch (error) {
        console.error('Failed to close OAuth waiting window:', error);
        return {
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    });

    // Listen for code submission from OAuth waiting window
    ipcMain.on('oauth:submit-code', (_event, code: string) => {
      console.log('Received OAuth code from waiting window');
      // Send the code to the main window's renderer
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('oauth:code-received', code);
      }
      // Close the waiting window
      this.closeOAuthWaitingWindow();
    });

    // Listen for OAuth cancellation
    ipcMain.on('oauth:cancel', (_event) => {
      console.log('OAuth flow cancelled by user');
      // Notify main window
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        this.mainWindow.webContents.send('oauth:cancelled');
      }
      // Close the waiting window
      this.closeOAuthWaitingWindow();
    });
  }

  /**
   * Clean up resources
   * Call this when the app is quitting
   */
  cleanup(): void {
    if (this.oauthCallbackServer) {
      this.oauthCallbackServer.close();
      console.log('OAuth callback server closed');
    }

    if (this.oauthWindow && !this.oauthWindow.isDestroyed()) {
      this.oauthWindow.close();
    }

    if (this.oauthWaitingWindow && !this.oauthWaitingWindow.isDestroyed()) {
      this.oauthWaitingWindow.close();
    }
  }
}
