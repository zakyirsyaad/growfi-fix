import type { GameInteractableType } from "@/lib/game/eventBus";

export type InteractableAction =
  | { kind: "overlay"; overlay: string; payload?: unknown }
  | { kind: "plot"; plotId: string; visitorMode?: boolean }
  | { kind: "map"; map: "farm" | "town" }
  | { kind: "event"; event: "returnHome" | "refillWater" | "refreshFarmState" }
  | { kind: "toast"; title: string; description?: string };

export type InteractableObject = {
  id: string;
  type: GameInteractableType;
  x: number;
  y: number;
  radius: number;
  priority?: number;
  label: string;
  action: InteractableAction;
};
