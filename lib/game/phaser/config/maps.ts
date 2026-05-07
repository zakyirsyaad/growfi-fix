import type { GameArea } from "@/lib/game/eventBus";

export type MapSpawn = {
  x: number;
  y: number;
};

export type GrowFiMapConfig = {
  area: GameArea;
  width: number;
  height: number;
  spawn: MapSpawn;
  background: "grass" | "town";
};

export const MAPS: Record<"farm" | "town", GrowFiMapConfig> = {
  farm: {
    area: "Home Farm",
    width: 1400,
    height: 960,
    spawn: { x: 320, y: 480 },
    background: "grass"
  },
  town: {
    area: "Town Social Hub",
    width: 1480,
    height: 1000,
    spawn: { x: 700, y: 810 },
    background: "town"
  }
};
