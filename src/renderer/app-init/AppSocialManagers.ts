/**
 * AppSocialManagers
 *
 * Initializes social features: friends, study rooms, messages, realtime notifications.
 */

import { FriendsManager } from '../managers/social/FriendsManager.js';
import { MessagesManager } from '../managers/social/MessagesManager.js';
import { FriendsModal } from '../components/FriendsModal.js';
import { StudyRoomsManager } from '../managers/social/StudyRoomsManager.js';
import { CreateRoomModal } from '../components/CreateRoomModal.js';
import { BrowseRoomsModal } from '../components/BrowseRoomsModal.js';
import { StudyRoomView } from '../components/StudyRoomView.js';
import { RealtimeNotificationManager } from '../managers/RealtimeNotificationManager.js';

export interface SocialManagers {
  friendsManager: FriendsManager;
  messagesManager: MessagesManager;
  friendsModal: FriendsModal;
  studyRoomsManager: StudyRoomsManager;
  createRoomModal: CreateRoomModal;
  browseRoomsModal: BrowseRoomsModal;
  studyRoomView: StudyRoomView;
  realtimeNotificationManager: RealtimeNotificationManager;
}

export class AppSocialManagers {
  /**
   * Initialize all social managers
   */
  static initialize(): SocialManagers {
    // Initialize friends system
    const friendsManager = new FriendsManager();
    const messagesManager = new MessagesManager();
    const friendsModal = new FriendsModal(friendsManager, messagesManager);
    friendsModal.initialize();

    // Expose friendsManager globally
    window.friendsManager = friendsManager;

    // Initialize study rooms system
    const studyRoomsManager = new StudyRoomsManager();
    const createRoomModal = new CreateRoomModal(studyRoomsManager, friendsManager);
    createRoomModal.initialize();
    const browseRoomsModal = new BrowseRoomsModal(studyRoomsManager);
    browseRoomsModal.initialize();
    const studyRoomView = new StudyRoomView(studyRoomsManager, friendsManager);
    studyRoomView.initialize();

    // Expose studyRoomsManager globally
    window.studyRoomsManager = studyRoomsManager;

    // Initialize realtime notification manager
    const realtimeNotificationManager = new RealtimeNotificationManager();

    // Wire up study rooms UI events
    window.addEventListener('show-create-room-modal', () => {
      console.log('show-create-room-modal event received!');
      createRoomModal.show((roomId) => {
        console.log('Room created, showing room view:', roomId);
        studyRoomView.show(roomId, () => {
          browseRoomsModal.show((nextRoomId) => studyRoomView.show(nextRoomId));
        });
      });
    });
    console.log('Registered show-create-room-modal event listener');

    return {
      friendsManager,
      messagesManager,
      friendsModal,
      studyRoomsManager,
      createRoomModal,
      browseRoomsModal,
      studyRoomView,
      realtimeNotificationManager,
    };
  }
}
