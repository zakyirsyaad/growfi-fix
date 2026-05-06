import * as Phaser from "phaser";
import { ASSET_KEYS } from "@/lib/game/phaser/config/assets";

export class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene: Phaser.Scene, x: number, y: number) {
    super(scene, x, y, ASSET_KEYS.characters.player);
    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.setCollideWorldBounds(true);
    this.setDepth(20);
    this.setSize(18, 20);
    this.setOffset(7, 11);
  }

  faceVelocity() {
    const body = this.body as Phaser.Physics.Arcade.Body | null;
    if (!body) {
      return;
    }
    if (body.velocity.x !== 0) {
      this.setFlipX(body.velocity.x < 0);
    }
  }
}
