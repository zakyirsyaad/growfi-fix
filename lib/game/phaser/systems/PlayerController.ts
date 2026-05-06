import * as Phaser from "phaser";
import { gameEventBus } from "@/lib/game/eventBus";
import { PLAYER_SPEED, PLAYER_SPRINT_SPEED } from "@/lib/game/phaser/config/controls";
import type { Player } from "@/lib/game/phaser/objects/Player";

export class PlayerController {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
  private keys?: Record<"w" | "a" | "s" | "d" | "shift", Phaser.Input.Keyboard.Key>;
  private joystick = new Phaser.Math.Vector2(0, 0);
  private cleanup: Array<() => void> = [];

  constructor(private scene: Phaser.Scene, private player: Player) {
    this.cursors = scene.input.keyboard?.createCursorKeys();
    this.keys = scene.input.keyboard?.addKeys({
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      shift: Phaser.Input.Keyboard.KeyCodes.SHIFT
    }) as Record<"w" | "a" | "s" | "d" | "shift", Phaser.Input.Keyboard.Key> | undefined;

    this.cleanup.push(
      gameEventBus.on("joystickMove", (vector) => {
        this.joystick.set(vector.x, vector.y);
      }),
      gameEventBus.on("joystickEnd", () => {
        this.joystick.set(0, 0);
      })
    );
  }

  update() {
    const body = this.player.body as Phaser.Physics.Arcade.Body | null;
    if (!body) {
      return;
    }

    const left = this.cursors?.left.isDown || this.keys?.a.isDown;
    const right = this.cursors?.right.isDown || this.keys?.d.isDown;
    const up = this.cursors?.up.isDown || this.keys?.w.isDown;
    const down = this.cursors?.down.isDown || this.keys?.s.isDown;
    const sprint = this.keys?.shift.isDown;

    const velocity = new Phaser.Math.Vector2(
      (right ? 1 : 0) - (left ? 1 : 0) + this.joystick.x,
      (down ? 1 : 0) - (up ? 1 : 0) + this.joystick.y
    );

    if (velocity.lengthSq() > 0) {
      velocity.normalize().scale(sprint ? PLAYER_SPRINT_SPEED : PLAYER_SPEED);
    }

    body.setVelocity(velocity.x, velocity.y);
    this.player.faceVelocity();
  }

  destroy() {
    this.cleanup.forEach((fn) => fn());
  }
}
