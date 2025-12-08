/**
 * Game Events - Simple event constants
 */

export const EVENTS = {
  // Room events
  ROOM_ENTER: 'roomEnter',
  ROOM_CLEAR: 'roomClear',

  // Door events
  DOOR_ACTIVATE: 'doorActivate',

  // Transition events
  TRANSITION_START: 'transitionStart',
  TRANSITION_END: 'transitionEnd',

  // Content events
  CONTENT_TRIGGER: 'contentTrigger',
} as const;

export type DungeonDirection = 'north' | 'south' | 'east' | 'west';

export interface DoorActivateEvent {
  direction: DungeonDirection;
  targetRoomId: string;
}
