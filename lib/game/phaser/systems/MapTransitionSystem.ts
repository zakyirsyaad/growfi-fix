import * as Phaser from "phaser";
import { gameEventBus } from "@/lib/game/eventBus";

type TransitionZone = {
  id: string;
  rect: Phaser.Geom.Rectangle;
  onEnter: () => void;
};

export class MapTransitionSystem {
  private zones: TransitionZone[] = [];
  private cooldownUntil = 0;
  private inputLocks = new Set<string>();
  private cleanup: Array<() => void> = [];

  constructor(private scene: Phaser.Scene, private player: Phaser.GameObjects.GameObject) {
    this.cleanup.push(
      gameEventBus.on("gameInputLockChanged", ({ source, locked }) => {
        if (locked) {
          this.inputLocks.add(source);
        } else {
          this.inputLocks.delete(source);
        }
      })
    );
  }

  add(zone: TransitionZone) {
    this.zones.push(zone);
  }

  update() {
    if (this.inputLocks.size > 0) {
      return;
    }
    if (this.scene.time.now < this.cooldownUntil) {
      return;
    }

    const sprite = this.player as Phaser.GameObjects.Sprite;
    const zone = this.zones.find((item) => Phaser.Geom.Rectangle.Contains(item.rect, sprite.x, sprite.y));
    if (zone) {
      this.cooldownUntil = this.scene.time.now + 900;
      zone.onEnter();
    }
  }

  destroy() {
    this.cleanup.forEach((fn) => fn());
    this.cleanup = [];
    this.zones = [];
  }
}
