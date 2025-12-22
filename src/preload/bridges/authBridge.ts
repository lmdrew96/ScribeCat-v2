/**
 * Auth IPC Bridge
 *
 * IPC bindings for authentication, OAuth, and user session management
 */

const { ipcRenderer } = require('electron');

import { AuthChannels, OAuthChannels } from '../../shared/IpcChannels.js';

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
    ipcRenderer.invoke(AuthChannels.SIGN_IN_WITH_EMAIL, params),
  signUpWithEmail: (params: SignUpWithEmailParams) =>
    ipcRenderer.invoke(AuthChannels.SIGN_UP_WITH_EMAIL, params),
  signOut: () => ipcRenderer.invoke(AuthChannels.SIGN_OUT),

  // Google OAuth
  signInWithGoogle: (codeChallenge: string) =>
    ipcRenderer.invoke(AuthChannels.SIGN_IN_WITH_GOOGLE, codeChallenge),
  openOAuthWindow: (authUrl: string) =>
    ipcRenderer.invoke(AuthChannels.OPEN_OAUTH_WINDOW, authUrl),

  // Session management
  getCurrentUser: () => ipcRenderer.invoke(AuthChannels.GET_CURRENT_USER),
  isAuthenticated: () => ipcRenderer.invoke(AuthChannels.IS_AUTHENTICATED),
  getAccessToken: () => ipcRenderer.invoke(AuthChannels.GET_ACCESS_TOKEN),
  sessionChanged: (data: { userId: string | null; accessToken?: string; refreshToken?: string }) =>
    ipcRenderer.invoke(AuthChannels.SESSION_CHANGED, data),

  // Username
  checkUsernameAvailability: (username: string) =>
    ipcRenderer.invoke(AuthChannels.CHECK_USERNAME_AVAILABILITY, username),
  setUsername: (username: string) =>
    ipcRenderer.invoke(AuthChannels.SET_USERNAME, username),

  // OAuth waiting window
  showOAuthWaitingWindow: () => ipcRenderer.invoke(OAuthChannels.SHOW_WAITING_WINDOW),
  closeOAuthWaitingWindow: () => ipcRenderer.invoke(OAuthChannels.CLOSE_WAITING_WINDOW),

  onOAuthCodeReceived: (callback: (code: string) => void) => {
    ipcRenderer.on(OAuthChannels.CODE_RECEIVED, (_event: Electron.IpcRendererEvent, code: string) => callback(code));
  },
  onOAuthCancelled: (callback: () => void) => {
    ipcRenderer.on(OAuthChannels.CANCELLED, () => callback());
  },
  removeOAuthListeners: () => {
    ipcRenderer.removeAllListeners(OAuthChannels.CODE_RECEIVED);
    ipcRenderer.removeAllListeners(OAuthChannels.CANCELLED);
  },
};
