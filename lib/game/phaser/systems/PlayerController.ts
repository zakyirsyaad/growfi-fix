import * as Phaser from "phaser";
import { gameEventBus } from "@/lib/game/eventBus";
import { PLAYER_SPEED, PLAYER_SPRINT_SPEED } from "@/lib/game/phaser/config/controls";
import type { Player } from "@/lib/game/phaser/objects/Player";

const scenesWithPlayerController = new WeakSet<Phaser.Scene>();

export class PlayerController {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | undefined;
  private keys?: Record<"w" | "a" | "s" | "d" | "shift", Phaser.Input.Keyboard.Key>;
  private joystick = new Phaser.Math.Vector2(0, 0);
  private destroyed = false;
  private inputLocks = new Set<string>();
  private cleanup: Array<() => void> = [];

  constructor(private scene: Phaser.Scene, private player: Player) {
    if (scenesWithPlayerController.has(scene)) {
      console.warn("[GrowFi] Duplicate PlayerController detected for scene", scene.scene.key);
    }
    scenesWithPlayerController.add(scene);

    this.cursors = scene.input.keyboard?.createCursorKeys();
    this.keys = scene.input.keyboard?.addKeys({
      w: Phaser.Input.Keyboard.KeyCodes.W,
      a: Phaser.Input.Keyboard.KeyCodes.A,
      s: Phaser.Input.Keyboard.KeyCodes.S,
      d: Phaser.Input.Keyboard.KeyCodes.D,
      shift: Phaser.Input.Keyboard.KeyCodes.SHIFT
    }) as Record<"w" | "a" | "s" | "d" | "shift", Phaser.Input.Keyboard.Key> | undefined;
    [
      Phaser.Input.Keyboard.KeyCodes.W,
      Phaser.Input.Keyboard.KeyCodes.A,
      Phaser.Input.Keyboard.KeyCodes.S,
      Phaser.Input.Keyboard.KeyCodes.D,
      Phaser.Input.Keyboard.KeyCodes.SHIFT,
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.DOWN,
      Phaser.Input.Keyboard.KeyCodes.LEFT,
      Phaser.Input.Keyboard.KeyCodes.RIGHT,
      Phaser.Input.Keyboard.KeyCodes.SPACE,
    ].forEach((keyCode) => scene.input.keyboard?.removeCapture(keyCode));

    this.cleanup.push(
      gameEventBus.on("joystickMove", (vector) => {
        this.joystick.set(vector.x, vector.y);
      }),
      gameEventBus.on("joystickEnd", () => {
        this.joystick.set(0, 0);
      }),
      gameEventBus.on("gameInputLockChanged", ({ source, locked }) => {
        if (locked) {
          this.inputLocks.add(source);
        } else {
          this.inputLocks.delete(source);
        }
      })
    );
  }

  update() {
    const body = this.player.body as Phaser.Physics.Arcade.Body | null;
    if (!body) {
      return;
    }

    if (this.inputLocks.size > 0 || this.textInputFocused()) {
      body.setVelocity(0, 0);
      this.player.faceVelocity();
      return;
    }

    const left = this.cursors?.left.isDown || this.keys?.a.isDown;
    const right = this.cursors?.right.isDown || this.keys?.d.isDown;
    const up = this.cursors?.up.isDown || this.keys?.w.isDown;
    const down = this.cursors?.down.isDown || this.keys?.s.isDown;
    const sprint = this.keys?.shift.isDown;

    let velocityX = (right ? 1 : 0) - (left ? 1 : 0) + this.joystick.x;
    let velocityY = (down ? 1 : 0) - (up ? 1 : 0) + this.joystick.y;
    const lengthSq = velocityX * velocityX + velocityY * velocityY;

    if (lengthSq > 0) {
      const speed = sprint ? PLAYER_SPRINT_SPEED : PLAYER_SPEED;
      const scale = speed / Math.sqrt(lengthSq);
      velocityX *= scale;
      velocityY *= scale;
    }

    body.setVelocity(velocityX, velocityY);
    this.player.faceVelocity();
  }

  destroy() {
    if (this.destroyed) {
      return;
    }
    this.destroyed = true;
    this.cleanup.forEach((fn) => fn());
    scenesWithPlayerController.delete(this.scene);
  }

  private textInputFocused() {
    if (typeof document === "undefined") {
      return false;
    }
    const element = document.activeElement;
    if (!element) {
      return false;
    }
    const tagName = element.tagName.toLowerCase();
    return (
      tagName === "input" ||
      tagName === "textarea" ||
      tagName === "select" ||
      (element as HTMLElement).isContentEditable
    );
  }
}
