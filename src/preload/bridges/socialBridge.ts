/**
 * Social IPC Bridges
 *
 * IPC bindings for friends, study rooms, chat, and direct messages
 *
 * NOTE: Realtime subscriptions (presence, messages, invitations) are handled
 * directly in renderer managers via RendererSupabaseClient since WebSockets
 * don't work in Electron's main process.
 */

const { ipcRenderer } = require('electron');

export const friendsBridge = {
  // Friends list
  getFriends: () => ipcRenderer.invoke('friends:getFriends'),
  getFriendsCount: () => ipcRenderer.invoke('friends:getFriendsCount'),
  removeFriend: (friendId: string) => ipcRenderer.invoke('friends:removeFriend', friendId),
  areFriends: (userId: string) => ipcRenderer.invoke('friends:areFriends', userId),
  getMutualFriendsCount: (userId: string) => ipcRenderer.invoke('friends:getMutualFriendsCount', userId),

  // Friend requests
  getFriendRequests: () => ipcRenderer.invoke('friends:getFriendRequests'),
  getIncomingRequests: () => ipcRenderer.invoke('friends:getIncomingRequests'),
  getOutgoingRequests: () => ipcRenderer.invoke('friends:getOutgoingRequests'),
  getIncomingRequestsCount: () => ipcRenderer.invoke('friends:getIncomingRequestsCount'),
  sendRequest: (recipientId: string) => ipcRenderer.invoke('friends:sendRequest', recipientId),
  acceptRequest: (requestId: string) => ipcRenderer.invoke('friends:acceptRequest', requestId),
  rejectRequest: (requestId: string) => ipcRenderer.invoke('friends:rejectRequest', requestId),
  cancelRequest: (requestId: string) => ipcRenderer.invoke('friends:cancelRequest', requestId),

  // User search & profiles
  searchUsers: (searchEmail: string, limit?: number) =>
    ipcRenderer.invoke('friends:searchUsers', searchEmail, limit),
  getUserProfile: (userId: string) => ipcRenderer.invoke('friends:getUserProfile', userId),

  // Presence
  updatePresence: (params: { userId: string; status: 'online' | 'away' | 'offline'; activity?: string }) =>
    ipcRenderer.invoke('friends:updatePresence', params),
  getUserPresence: (userId: string) => ipcRenderer.invoke('friends:getUserPresence', userId),
  getFriendsPresence: (userId: string) => ipcRenderer.invoke('friends:getFriendsPresence', userId),
  setOffline: (userId: string) => ipcRenderer.invoke('friends:setOffline', userId),
};

export const studyRoomsBridge = {
  // Room operations
  createRoom: (params: { name: string; sessionId: string; maxParticipants: number }) =>
    ipcRenderer.invoke('rooms:createRoom', params),
  getUserRooms: () => ipcRenderer.invoke('rooms:getUserRooms'),
  getRejoinableRooms: () => ipcRenderer.invoke('rooms:getRejoinableRooms'),
  getRoomById: (roomId: string) => ipcRenderer.invoke('rooms:getRoomById', roomId),
  closeRoom: (roomId: string) => ipcRenderer.invoke('rooms:closeRoom', roomId),
  updateRoom: (params: { roomId: string; name?: string; maxParticipants?: number }) =>
    ipcRenderer.invoke('rooms:updateRoom', params),

  // Participant operations
  getRoomParticipants: (roomId: string) => ipcRenderer.invoke('rooms:getRoomParticipants', roomId),
  getParticipantCount: (roomId: string) => ipcRenderer.invoke('rooms:getParticipantCount', roomId),
  joinRoom: (roomId: string) => ipcRenderer.invoke('rooms:joinRoom', roomId),
  leaveRoom: (roomId: string) => ipcRenderer.invoke('rooms:leaveRoom', roomId),
  removeParticipant: (params: { roomId: string; participantId: string }) =>
    ipcRenderer.invoke('rooms:removeParticipant', params),
  isUserInRoom: (roomId: string) => ipcRenderer.invoke('rooms:isUserInRoom', roomId),

  // Invitation operations
  sendInvitation: (params: { roomId: string; inviteeId: string }) =>
    ipcRenderer.invoke('rooms:sendInvitation', params),
  getUserInvitations: () => ipcRenderer.invoke('rooms:getUserInvitations'),
  getPendingInvitations: () => ipcRenderer.invoke('rooms:getPendingInvitations'),
  acceptInvitation: (invitationId: string) => ipcRenderer.invoke('rooms:acceptInvitation', invitationId),
  declineInvitation: (invitationId: string) => ipcRenderer.invoke('rooms:declineInvitation', invitationId),
  cancelInvitation: (invitationId: string) => ipcRenderer.invoke('rooms:cancelInvitation', invitationId),
};

export const chatBridge = {
  sendMessage: (params: { roomId: string; userId: string; message: string }) =>
    ipcRenderer.invoke('chat:sendMessage', params),
  getRoomMessages: (roomId: string, limit?: number) =>
    ipcRenderer.invoke('chat:getRoomMessages', roomId, limit),
  deleteMessage: (messageId: string, userId: string) =>
    ipcRenderer.invoke('chat:deleteMessage', messageId, userId),
};

export const messagesBridge = {
  send: (params: { recipientId: string; subject?: string; content: string; attachments?: any[] }) =>
    ipcRenderer.invoke('messages:send', params),
  getInbox: (limit?: number) => ipcRenderer.invoke('messages:getInbox', limit),
  getSent: (limit?: number) => ipcRenderer.invoke('messages:getSent', limit),
  getConversation: (params: { otherUserId: string; limit?: number }) =>
    ipcRenderer.invoke('messages:getConversation', params),
  getMessage: (messageId: string) => ipcRenderer.invoke('messages:getMessage', messageId),
  markAsRead: (messageId: string) => ipcRenderer.invoke('messages:markAsRead', messageId),
  markConversationAsRead: (senderId: string) => ipcRenderer.invoke('messages:markConversationAsRead', senderId),
  getUnreadCount: () => ipcRenderer.invoke('messages:getUnreadCount'),
  delete: (messageId: string) => ipcRenderer.invoke('messages:delete', messageId),
  uploadAttachment: (params: { data: ArrayBuffer; name: string; type: string }) =>
    ipcRenderer.invoke('messages:uploadAttachment', params),
};

export const shareBridge = {
  checkAccess: (sessionId: string) => ipcRenderer.invoke('share:checkAccess', sessionId),
  create: (params: { sessionId: string; email: string; permissionLevel: 'viewer' | 'editor' }) =>
    ipcRenderer.invoke('share:create', params),
  remove: (params: { shareId?: string; invitationId?: string }) =>
    ipcRenderer.invoke('share:remove', params),
  updatePermission: (params: { shareId: string; permissionLevel: 'viewer' | 'editor' }) =>
    ipcRenderer.invoke('share:updatePermission', params),
  getSessionShares: (sessionId: string) => ipcRenderer.invoke('share:getSessionShares', sessionId),
  getSharedWithMe: () => ipcRenderer.invoke('share:getSharedWithMe'),
  acceptInvitation: (token: string) => ipcRenderer.invoke('share:acceptInvitation', token),
};
