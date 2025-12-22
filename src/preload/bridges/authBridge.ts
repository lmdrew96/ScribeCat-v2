/**
 * Auth IPC Bridge
 *
 * IPC bindings for authentication, OAuth, and user session management
 */

const { ipcRenderer } = require('electron');

interface SignInWithEmailParams {
  email: string;
  password: string;
}

interface SignUpWithEmailParams {
  email: string;
  password: string;
  fullName?: string;
}

export const authBridge = {
  // Email auth
  signInWithEmail: (params: SignInWithEmailParams) =>
    ipcRenderer.invoke('auth:signInWithEmail', params),
  signUpWithEmail: (params: SignUpWithEmailParams) =>
    ipcRenderer.invoke('auth:signUpWithEmail', params),
  signOut: () => ipcRenderer.invoke('auth:signOut'),

  // Google OAuth
  signInWithGoogle: (codeChallenge: string) =>
    ipcRenderer.invoke('auth:signInWithGoogle', codeChallenge),
  openOAuthWindow: (authUrl: string) =>
    ipcRenderer.invoke('auth:openOAuthWindow', authUrl),

  // Session management
  getCurrentUser: () => ipcRenderer.invoke('auth:getCurrentUser'),
  isAuthenticated: () => ipcRenderer.invoke('auth:isAuthenticated'),
  getAccessToken: () => ipcRenderer.invoke('auth:getAccessToken'),
  sessionChanged: (data: { userId: string | null; accessToken?: string; refreshToken?: string }) =>
    ipcRenderer.invoke('auth:sessionChanged', data),

  // Username
  checkUsernameAvailability: (username: string) =>
    ipcRenderer.invoke('auth:checkUsernameAvailability', username),
  setUsername: (username: string) =>
    ipcRenderer.invoke('auth:setUsername', username),

  // OAuth waiting window
  showOAuthWaitingWindow: () => ipcRenderer.invoke('oauth:showWaitingWindow'),
  closeOAuthWaitingWindow: () => ipcRenderer.invoke('oauth:closeWaitingWindow'),

  onOAuthCodeReceived: (callback: (code: string) => void) => {
    ipcRenderer.on('oauth:code-received', (_event: Electron.IpcRendererEvent, code: string) => callback(code));
  },
  onOAuthCancelled: (callback: () => void) => {
    ipcRenderer.on('oauth:cancelled', () => callback());
  },
  removeOAuthListeners: () => {
    ipcRenderer.removeAllListeners('oauth:code-received');
    ipcRenderer.removeAllListeners('oauth:cancelled');
  },
};
