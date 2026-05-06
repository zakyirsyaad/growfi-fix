import * as Phaser from "phaser";
import { BootScene } from "@/lib/game/phaser/scenes/BootScene";
import { PreloadScene } from "@/lib/game/phaser/scenes/PreloadScene";
import { FarmScene } from "@/lib/game/phaser/scenes/FarmScene";
import { TownScene } from "@/lib/game/phaser/scenes/TownScene";

export function createGrowFiGame(parent: HTMLElement) {
  return new Phaser.Game({
    type: Phaser.AUTO,
    parent,
    backgroundColor: "#7fc668",
    scale: {
      mode: Phaser.Scale.RESIZE,
      width: parent.clientWidth,
      height: parent.clientHeight
    },
    physics: {
      default: "arcade",
      arcade: {
        debug: false
      }
    },
    pixelArt: true,
    roundPixels: true,
    scene: [BootScene, PreloadScene, FarmScene, TownScene]
  });
}
