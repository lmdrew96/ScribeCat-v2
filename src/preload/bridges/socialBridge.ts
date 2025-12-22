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

import {
  FriendsChannels,
  RoomsChannels,
  ChatChannels,
  MessagesChannels,
  ShareChannels,
} from '../../shared/IpcChannels.js';
import type { MessageAttachment } from '../../shared/types.js';

export const friendsBridge = {
  // Friends list
  getFriends: () => ipcRenderer.invoke(FriendsChannels.GET_FRIENDS),
  getFriendsCount: () => ipcRenderer.invoke(FriendsChannels.GET_FRIENDS_COUNT),
  removeFriend: (friendId: string) => ipcRenderer.invoke(FriendsChannels.REMOVE_FRIEND, friendId),
  areFriends: (userId: string) => ipcRenderer.invoke(FriendsChannels.ARE_FRIENDS, userId),
  getMutualFriendsCount: (userId: string) => ipcRenderer.invoke(FriendsChannels.GET_MUTUAL_FRIENDS_COUNT, userId),

  // Friend requests
  getFriendRequests: () => ipcRenderer.invoke(FriendsChannels.GET_FRIEND_REQUESTS),
  getIncomingRequests: () => ipcRenderer.invoke(FriendsChannels.GET_INCOMING_REQUESTS),
  getOutgoingRequests: () => ipcRenderer.invoke(FriendsChannels.GET_OUTGOING_REQUESTS),
  getIncomingRequestsCount: () => ipcRenderer.invoke(FriendsChannels.GET_INCOMING_REQUESTS_COUNT),
  sendRequest: (recipientId: string) => ipcRenderer.invoke(FriendsChannels.SEND_REQUEST, recipientId),
  acceptRequest: (requestId: string) => ipcRenderer.invoke(FriendsChannels.ACCEPT_REQUEST, requestId),
  rejectRequest: (requestId: string) => ipcRenderer.invoke(FriendsChannels.REJECT_REQUEST, requestId),
  cancelRequest: (requestId: string) => ipcRenderer.invoke(FriendsChannels.CANCEL_REQUEST, requestId),

  // User search & profiles
  searchUsers: (searchEmail: string, limit?: number) =>
    ipcRenderer.invoke(FriendsChannels.SEARCH_USERS, searchEmail, limit),
  getUserProfile: (userId: string) => ipcRenderer.invoke(FriendsChannels.GET_USER_PROFILE, userId),

  // Presence
  updatePresence: (params: { userId: string; status: 'online' | 'away' | 'offline'; activity?: string }) =>
    ipcRenderer.invoke(FriendsChannels.UPDATE_PRESENCE, params),
  getUserPresence: (userId: string) => ipcRenderer.invoke(FriendsChannels.GET_USER_PRESENCE, userId),
  getFriendsPresence: (userId: string) => ipcRenderer.invoke(FriendsChannels.GET_FRIENDS_PRESENCE, userId),
  setOffline: (userId: string) => ipcRenderer.invoke(FriendsChannels.SET_OFFLINE, userId),
};

export const studyRoomsBridge = {
  // Room operations
  createRoom: (params: { name: string; sessionId: string; maxParticipants: number }) =>
    ipcRenderer.invoke(RoomsChannels.CREATE_ROOM, params),
  getUserRooms: () => ipcRenderer.invoke(RoomsChannels.GET_USER_ROOMS),
  getRejoinableRooms: () => ipcRenderer.invoke(RoomsChannels.GET_REJOINABLE_ROOMS),
  getRoomById: (roomId: string) => ipcRenderer.invoke(RoomsChannels.GET_ROOM_BY_ID, roomId),
  closeRoom: (roomId: string) => ipcRenderer.invoke(RoomsChannels.CLOSE_ROOM, roomId),
  updateRoom: (params: { roomId: string; name?: string; maxParticipants?: number }) =>
    ipcRenderer.invoke(RoomsChannels.UPDATE_ROOM, params),

  // Participant operations
  getRoomParticipants: (roomId: string) => ipcRenderer.invoke(RoomsChannels.GET_ROOM_PARTICIPANTS, roomId),
  getParticipantCount: (roomId: string) => ipcRenderer.invoke(RoomsChannels.GET_PARTICIPANT_COUNT, roomId),
  joinRoom: (roomId: string) => ipcRenderer.invoke(RoomsChannels.JOIN_ROOM, roomId),
  leaveRoom: (roomId: string) => ipcRenderer.invoke(RoomsChannels.LEAVE_ROOM, roomId),
  removeParticipant: (params: { roomId: string; participantId: string }) =>
    ipcRenderer.invoke(RoomsChannels.REMOVE_PARTICIPANT, params),
  isUserInRoom: (roomId: string) => ipcRenderer.invoke(RoomsChannels.IS_USER_IN_ROOM, roomId),

  // Invitation operations
  sendInvitation: (params: { roomId: string; inviteeId: string }) =>
    ipcRenderer.invoke(RoomsChannels.SEND_INVITATION, params),
  getUserInvitations: () => ipcRenderer.invoke(RoomsChannels.GET_USER_INVITATIONS),
  getPendingInvitations: () => ipcRenderer.invoke(RoomsChannels.GET_PENDING_INVITATIONS),
  acceptInvitation: (invitationId: string) => ipcRenderer.invoke(RoomsChannels.ACCEPT_INVITATION, invitationId),
  declineInvitation: (invitationId: string) => ipcRenderer.invoke(RoomsChannels.DECLINE_INVITATION, invitationId),
  cancelInvitation: (invitationId: string) => ipcRenderer.invoke(RoomsChannels.CANCEL_INVITATION, invitationId),
};

export const chatBridge = {
  sendMessage: (params: { roomId: string; userId: string; message: string }) =>
    ipcRenderer.invoke(ChatChannels.SEND_MESSAGE, params),
  getRoomMessages: (roomId: string, limit?: number) =>
    ipcRenderer.invoke(ChatChannels.GET_ROOM_MESSAGES, roomId, limit),
  deleteMessage: (messageId: string, userId: string) =>
    ipcRenderer.invoke(ChatChannels.DELETE_MESSAGE, messageId, userId),
};

export const messagesBridge = {
  send: (params: { recipientId: string; subject?: string; content: string; attachments?: MessageAttachment[] }) =>
    ipcRenderer.invoke(MessagesChannels.SEND, params),
  getInbox: (limit?: number) => ipcRenderer.invoke(MessagesChannels.GET_INBOX, limit),
  getSent: (limit?: number) => ipcRenderer.invoke(MessagesChannels.GET_SENT, limit),
  getConversation: (params: { otherUserId: string; limit?: number }) =>
    ipcRenderer.invoke(MessagesChannels.GET_CONVERSATION, params),
  getMessage: (messageId: string) => ipcRenderer.invoke(MessagesChannels.GET_MESSAGE, messageId),
  markAsRead: (messageId: string) => ipcRenderer.invoke(MessagesChannels.MARK_AS_READ, messageId),
  markConversationAsRead: (senderId: string) => ipcRenderer.invoke(MessagesChannels.MARK_CONVERSATION_AS_READ, senderId),
  getUnreadCount: () => ipcRenderer.invoke(MessagesChannels.GET_UNREAD_COUNT),
  delete: (messageId: string) => ipcRenderer.invoke(MessagesChannels.DELETE, messageId),
  uploadAttachment: (params: { data: ArrayBuffer; name: string; type: string }) =>
    ipcRenderer.invoke(MessagesChannels.UPLOAD_ATTACHMENT, params),
};

export const shareBridge = {
  checkAccess: (sessionId: string) => ipcRenderer.invoke(ShareChannels.CHECK_ACCESS, sessionId),
  create: (params: { sessionId: string; email: string; permissionLevel: 'viewer' | 'editor' }) =>
    ipcRenderer.invoke(ShareChannels.CREATE, params),
  remove: (params: { shareId?: string; invitationId?: string }) =>
    ipcRenderer.invoke(ShareChannels.REMOVE, params),
  updatePermission: (params: { shareId: string; permissionLevel: 'viewer' | 'editor' }) =>
    ipcRenderer.invoke(ShareChannels.UPDATE_PERMISSION, params),
  getSessionShares: (sessionId: string) => ipcRenderer.invoke(ShareChannels.GET_SESSION_SHARES, sessionId),
  getSharedWithMe: () => ipcRenderer.invoke(ShareChannels.GET_SHARED_WITH_ME),
  acceptInvitation: (token: string) => ipcRenderer.invoke(ShareChannels.ACCEPT_INVITATION, token),
};
