/**
 * GameEvents - Type-safe event definitions for KAPLAY
 *
 * Use with k.on() and k.trigger()
 */

import type { DungeonRoom, RoomContent, Direction as DungeonDirection } from '../../canvas/dungeon/DungeonGenerator.js';

// Event payload types
export interface RoomEnterEvent {
  room: DungeonRoom;
  fromDirection?: DungeonDirection;
}

export interface ContentTriggerEvent {
  content: RoomContent;
  room: DungeonRoom;
}

export interface DoorActivateEvent {
  direction: DungeonDirection;
  targetRoomId: string;
}

export interface DamageEvent {
  amount: number;
  source: string;
}

// Event name constants (prevents typos)
export const EVENTS = {
  ROOM_ENTER: 'roomEnter',
  ROOM_EXIT: 'roomExit',
  ROOM_CLEAR: 'roomClear',
  CONTENT_TRIGGER: 'contentTrigger',
  DOOR_ACTIVATE: 'doorActivate',
  PLAYER_DAMAGE: 'playerDamage',
  PLAYER_HEAL: 'playerHeal',
  XP_GAIN: 'xpGain',
  GOLD_GAIN: 'goldGain',
  TRANSITION_START: 'transitionStart',
  TRANSITION_END: 'transitionEnd',
} as const;
