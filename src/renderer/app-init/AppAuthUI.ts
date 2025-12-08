/**
 * AppAuthUI
 *
 * Handles authentication UI setup and auth state changes.
 */

import type { AuthManager } from '../managers/AuthManager.js';
import type { AuthScreen } from '../components/AuthScreen.js';
import type { FriendsManager } from '../managers/social/FriendsManager.js';
import type { MessagesManager } from '../managers/social/MessagesManager.js';
import type { StudyRoomsManager } from '../managers/social/StudyRoomsManager.js';
import type { BrowseRoomsModal } from '../components/BrowseRoomsModal.js';
import type { StudyRoomView } from '../components/StudyRoomView.js';
import type { RealtimeNotificationManager } from '../managers/RealtimeNotificationManager.js';
import type { notificationTicker } from '../managers/NotificationTicker.js';
import type { StudyQuestModal } from '../components/StudyQuestModal.js';

export interface AuthUIDependencies {
  authManager: AuthManager;
  authScreen: AuthScreen;
  friendsManager: FriendsManager;
  messagesManager: MessagesManager;
  studyRoomsManager: StudyRoomsManager;
  browseRoomsModal: BrowseRoomsModal;
  studyRoomView: StudyRoomView;
  realtimeNotificationManager: RealtimeNotificationManager;
  notificationTicker: typeof notificationTicker;
  studyQuestModal: StudyQuestModal;
}

export class AppAuthUI {
  /**
   * Set up authentication UI
   */
  static setup(deps: AuthUIDependencies): void {
    const signinBtn = document.getElementById('signin-btn');
    const friendsBtn = document.getElementById('friends-btn');
    const studyRoomsBtn = document.getElementById('study-rooms-btn');
    const studyQuestBtn = document.getElementById('studyquest-btn');

    // Listen for auth state changes
    deps.authManager.onAuthStateChange(async (user) => {
      if (user) {
        // User is authenticated
        AppAuthUI.handleUserSignedIn(deps, user, signinBtn, friendsBtn, studyRoomsBtn, studyQuestBtn);
      } else {
        // User is not authenticated
        AppAuthUI.handleUserSignedOut(deps, signinBtn, friendsBtn, studyRoomsBtn, studyQuestBtn);
      }
    });

    // Add click listener to signin button
    signinBtn?.addEventListener('click', () => {
      deps.authScreen.show();
    });

    // StudyQuest button click - opens the game modal
    studyQuestBtn?.addEventListener('click', () => {
      deps.studyQuestModal?.open();
    });
  }

  /**
   * Handle user signed in state
   */
  private static async handleUserSignedIn(
    deps: AuthUIDependencies,
    user: any,
    signinBtn: HTMLElement | null,
    friendsBtn: HTMLElement | null,
    studyRoomsBtn: HTMLElement | null,
    studyQuestBtn: HTMLElement | null
  ): Promise<void> {
    // Hide signin button, show friends, study rooms, and StudyQuest buttons
    signinBtn?.classList.add('hidden');
    if (friendsBtn) {
      friendsBtn.style.display = 'block';
    }
    if (studyRoomsBtn) {
      studyRoomsBtn.style.display = 'block';
    }
    if (studyQuestBtn) {
      studyQuestBtn.style.display = 'flex';
    }

    // Initialize managers for this user
    await deps.friendsManager.initialize(user.id);
    await deps.studyRoomsManager.initialize(user.id);
    await deps.messagesManager.initialize(user.id);

    // TODO: Initialize StudyQuest manager - will be rebuilt with KAPLAY
    // if (deps.studyQuestManager) {
    //   await deps.studyQuestManager.initialize();
    // }

    // Initialize realtime notification manager
    deps.realtimeNotificationManager.initialize(
      deps.studyRoomsManager,
      deps.friendsManager,
      deps.notificationTicker,
      user.id
    );

    // Set current user ID for study rooms UI components
    deps.browseRoomsModal.setCurrentUserId(user.id);
    deps.studyRoomView.setCurrentUserInfo(user.id, user.email, user.fullName || user.email);

    // Update study rooms badge
    AppAuthUI.setupStudyRoomsBadge(deps, user.id);

    // Update friends badge
    AppAuthUI.setupFriendsBadge(deps);
  }

  /**
   * Handle user signed out state
   */
  private static handleUserSignedOut(
    deps: AuthUIDependencies,
    signinBtn: HTMLElement | null,
    friendsBtn: HTMLElement | null,
    studyRoomsBtn: HTMLElement | null,
    studyQuestBtn: HTMLElement | null
  ): void {
    // Show signin button, hide friends, study rooms, and StudyQuest buttons
    signinBtn?.classList.remove('hidden');
    if (friendsBtn) {
      friendsBtn.style.display = 'none';
    }
    if (studyRoomsBtn) {
      studyRoomsBtn.style.display = 'none';
    }
    if (studyQuestBtn) {
      studyQuestBtn.style.display = 'none';
    }

    // Clear managers
    deps.friendsManager.clear();
    deps.studyRoomsManager.clear();
    deps.messagesManager.clear();
    deps.realtimeNotificationManager.clear();

    // TODO: Clear StudyQuest manager - will be rebuilt with KAPLAY
    // if (deps.studyQuestManager) {
    //   deps.studyQuestManager.cleanup();
    // }

    // Clear user ID from study rooms UI components
    deps.browseRoomsModal.setCurrentUserId(null);
    deps.studyRoomView.setCurrentUserId(null);
  }

  /**
   * Set up study rooms badge with pending invitations
   */
  private static setupStudyRoomsBadge(deps: AuthUIDependencies, userId: string): void {
    const invitationsCount = deps.studyRoomsManager.getPendingInvitationsCount();
    const roomsBadge = document.getElementById('rooms-badge');
    if (roomsBadge) {
      roomsBadge.textContent = invitationsCount.toString();
      roomsBadge.style.display = invitationsCount > 0 ? 'inline-block' : 'none';
    }

    // Listen for invitations changes
    deps.studyRoomsManager.addInvitationsListener((invitations) => {
      const pendingCount = invitations.filter(inv =>
        inv.status === 'pending' && inv.inviteeId === userId
      ).length;
      const badge = document.getElementById('rooms-badge');
      if (badge) {
        badge.textContent = pendingCount.toString();
        badge.style.display = pendingCount > 0 ? 'inline-block' : 'none';
      }
    });
  }

  /**
   * Set up friends badge with combined requests and unread messages count
   */
  private static setupFriendsBadge(deps: AuthUIDependencies): void {
    const updateFriendsBadge = () => {
      const requestsCount = deps.friendsManager.getIncomingRequestsCount();
      const unreadMessagesCount = deps.messagesManager.getUnreadCount();
      const totalCount = requestsCount + unreadMessagesCount;
      const badge = document.getElementById('friends-badge');
      if (badge) {
        badge.textContent = totalCount.toString();
        badge.style.display = totalCount > 0 ? 'inline-block' : 'none';
      }
    };

    // Initial badge update
    updateFriendsBadge();

    // Listen for changes
    deps.friendsManager.addRequestsListener(() => {
      updateFriendsBadge();
    });

    deps.messagesManager.addUnreadCountListener(() => {
      updateFriendsBadge();
    });
  }
}
