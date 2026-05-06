import * as Phaser from "phaser";

type TransitionZone = {
  id: string;
  rect: Phaser.Geom.Rectangle;
  onEnter: () => void;
};

export class MapTransitionSystem {
  private zones: TransitionZone[] = [];
  private cooldownUntil = 0;

  constructor(private scene: Phaser.Scene, private player: Phaser.GameObjects.GameObject) {}

  add(zone: TransitionZone) {
    this.zones.push(zone);
  }

  update() {
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
}
