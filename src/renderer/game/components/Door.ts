/**
 * Door Component
 *
 * Creates door/entrance entities that players can interact with
 * to transition between scenes or rooms.
 */

import type { KAPLAYCtx, GameObj, Color } from 'kaplay';

export interface DoorConfig {
  k: KAPLAYCtx;
  x: number;
  y: number;
  width?: number;
  height?: number;
  label: string;
  targetScene: string;
  targetData?: Record<string, unknown>;
  color?: Color;
  visible?: boolean; // If false, door is invisible (for map-based entrances)
}

export interface Door {
  entity: GameObj;
  label: string;
  targetScene: string;
  targetData: Record<string, unknown>;
  getPromptText: () => string;
  enter: () => void;
  destroy: () => void;
}

export function createDoor(config: DoorConfig): Door {
  const {
    k,
    x,
    y,
    width = 40,
    height = 50,
    label,
    targetScene,
    targetData = {},
    color,
    visible = true,
  } = config;

  const components: unknown[] = [
    k.pos(x, y),
    k.anchor('center'),
    k.area({ shape: new k.Rect(k.vec2(0, 0), width, height) }),
    k.z(5),
    'door',
    { doorLabel: label, targetScene },
  ];

  // Add visual representation if visible
  if (visible) {
    components.unshift(k.rect(width, height));
    if (color) {
      components.push(k.color(color));
    } else {
      components.push(k.color(101, 67, 33)); // Default brown door
    }
    components.push(k.outline(2, k.rgb(0, 0, 0)));
  }

  const entity = k.add(components as Parameters<typeof k.add>[0]);

  // Track if we're currently transitioning
  let isTransitioning = false;

  async function enter(): Promise<void> {
    if (isTransitioning) return;
    isTransitioning = true;

    // Fade out transition
    const overlay = k.add([
      k.rect(640, 400),
      k.pos(0, 0),
      k.color(0, 0, 0),
      k.opacity(0),
      k.z(1000),
    ]);

    await k.tween(0, 1, 0.25, (v) => (overlay.opacity = v), k.easings.easeInQuad);

    // Go to target scene
    k.go(targetScene, { ...targetData, fromScene: 'town' });
  }

  return {
    entity,
    label,
    targetScene,
    targetData,

    getPromptText(): string {
      return `ENTER to go to ${label}`;
    },

    enter,

    destroy(): void {
      if (entity.exists()) {
        k.destroy(entity);
      }
    },
  };
}

/**
 * Create a building with a door
 */
export interface BuildingConfig {
  k: KAPLAYCtx;
  x: number;
  y: number;
  label: string;
  targetScene: string;
  targetData?: Record<string, unknown>;
  buildingColor: Color;
  roofColor?: Color;
}

export interface Building {
  buildingEntity: GameObj;
  roofEntity: GameObj;
  doorEntity: GameObj;
  labelEntity: GameObj;
  door: Door;
  destroy: () => void;
}

export function createBuilding(config: BuildingConfig): Building {
  const {
    k,
    x,
    y, // y is the ground level
    label,
    targetScene,
    targetData = {},
    buildingColor,
    roofColor = k.rgb(50, 50, 50),
  } = config;

  const buildingWidth = 80;
  const buildingHeight = 100;
  const roofHeight = 20;
  const doorWidth = 24;
  const doorHeight = 40;

  // Building body
  const buildingEntity = k.add([
    k.rect(buildingWidth, buildingHeight),
    k.pos(x - buildingWidth / 2, y - buildingHeight),
    k.color(buildingColor),
    k.outline(3, k.rgb(0, 0, 0)),
    k.z(3),
    'building',
  ]);

  // Roof
  const roofEntity = k.add([
    k.rect(buildingWidth + 10, roofHeight),
    k.pos(x - (buildingWidth + 10) / 2, y - buildingHeight - 15),
    k.color(roofColor),
    k.z(4),
    'building-roof',
  ]);

  // Door (visual only, the actual interactable is the Door component)
  const doorEntity = k.add([
    k.rect(doorWidth, doorHeight),
    k.pos(x - doorWidth / 2, y - doorHeight),
    k.color(101, 67, 33),
    k.outline(2, k.rgb(0, 0, 0)),
    k.z(4),
    'building-door-visual',
  ]);

  // Label above building
  const labelEntity = k.add([
    k.text(label, { size: 10 }),
    k.pos(x, y - buildingHeight - 20),
    k.anchor('center'),
    k.color(255, 255, 255),
    k.z(10),
    'building-label',
  ]);

  // Create interactable door (invisible, positioned at door area)
  const door = createDoor({
    k,
    x,
    y: y - doorHeight / 2,
    width: doorWidth + 20, // Slightly wider for easier interaction
    height: doorHeight + 20,
    label,
    targetScene,
    targetData,
    visible: false, // Door visual is already rendered above
  });

  return {
    buildingEntity,
    roofEntity,
    doorEntity,
    labelEntity,
    door,

    destroy(): void {
      k.destroy(buildingEntity);
      k.destroy(roofEntity);
      k.destroy(doorEntity);
      k.destroy(labelEntity);
      door.destroy();
    },
  };
}
