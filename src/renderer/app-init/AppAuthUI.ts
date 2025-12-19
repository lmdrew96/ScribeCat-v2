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
import type { StudyQuestManager } from '../managers/StudyQuestManager.js';

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
  studyQuestManager: StudyQuestManager;
}

export class AppAuthUI {
  /**
   * Set up authentication UI
   */
  static setup(deps: AuthUIDependencies): void {
    // Listen for auth state changes
    deps.authManager.onAuthStateChange(async (user) => {
      if (user) {
        // User is authenticated
        AppAuthUI.handleUserSignedIn(deps, user);
      } else {
        // User is not authenticated
        AppAuthUI.handleUserSignedOut(deps);
      }
    });

    // Note: Button click handlers are now managed by HeaderActionsMenu
  }

  /**
   * Handle user signed in state
   */
  private static async handleUserSignedIn(
    deps: AuthUIDependencies,
    user: any
  ): Promise<void> {
    // Initialize managers for this user
    await deps.friendsManager.initialize(user.id);
    await deps.studyRoomsManager.initialize(user.id);
    await deps.messagesManager.initialize(user.id);

    // Initialize StudyQuest manager for realtime character updates and rewards
    if (deps.studyQuestManager) {
      await deps.studyQuestManager.initialize(user.id);
    }

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

    // Update HeaderActionsMenu badge counts
    AppAuthUI.setupHeaderMenuBadges(deps, user.id);
  }

  /**
   * Handle user signed out state
   */
  private static handleUserSignedOut(
    deps: AuthUIDependencies
  ): void {
    // Clear managers
    deps.friendsManager.clear();
    deps.studyRoomsManager.clear();
    deps.messagesManager.clear();
    deps.realtimeNotificationManager.clear();

    // Cleanup StudyQuest manager (unsubscribe from realtime, clear state)
    if (deps.studyQuestManager) {
      deps.studyQuestManager.cleanup();
    }

    // Clear user ID from study rooms UI components
    deps.browseRoomsModal.setCurrentUserId(null);
    deps.studyRoomView.setCurrentUserId(null);
  }

  /**
   * Set up badge counts for HeaderActionsMenu
   */
  private static setupHeaderMenuBadges(deps: AuthUIDependencies, userId: string): void {
    // Get HeaderActionsMenu from window (set in app.ts)
    const headerMenu = (window as any).headerActionsMenu;

    // Update friends badge
    const updateFriendsBadge = () => {
      const requestsCount = deps.friendsManager.getIncomingRequestsCount();
      const unreadMessagesCount = deps.messagesManager.getUnreadCount();
      const totalCount = requestsCount + unreadMessagesCount;
      headerMenu?.updateFriendsCount(totalCount);
    };

    // Update rooms badge
    const updateRoomsBadge = () => {
      const pendingCount = deps.studyRoomsManager.getPendingInvitationsCount();
      headerMenu?.updateRoomsCount(pendingCount);
    };

    // Initial badge updates
    updateFriendsBadge();
    updateRoomsBadge();

    // Listen for changes
    deps.friendsManager.addRequestsListener(() => {
      updateFriendsBadge();
    });

    deps.messagesManager.addUnreadCountListener(() => {
      updateFriendsBadge();
    });

    deps.studyRoomsManager.addInvitationsListener((invitations) => {
      const pendingCount = invitations.filter(inv =>
        inv.status === 'pending' && inv.inviteeId === userId
      ).length;
      headerMenu?.updateRoomsCount(pendingCount);
    });
  }
}
