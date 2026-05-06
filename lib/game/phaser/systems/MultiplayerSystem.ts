import * as Phaser from "phaser";
import { gameEventBus } from "@/lib/game/eventBus";
import { joinRealtimeRoom, leaveRealtimeRoom, sendMovement, sendStop } from "@/lib/realtime/socketClient";
import type { Player } from "@/lib/game/phaser/objects/Player";
import type { RemotePlayerSystem } from "@/lib/game/phaser/systems/RemotePlayerSystem";
import type { PlayerDirection, RealtimeRoom } from "@/lib/realtime/types";

export class MultiplayerSystem {
  private room?: RealtimeRoom;
  private lastSentAt = 0;
  private lastX = Number.NaN;
  private lastY = Number.NaN;
  private cleanup: Array<() => void> = [];

  constructor(
    private scene: Phaser.Scene,
    private player: Player,
    private remotePlayers: RemotePlayerSystem
  ) {
    this.cleanup.push(
      gameEventBus.on("roomPlayersUpdated", ({ room, players }) => {
        if (room === this.room) {
          this.remotePlayers.setPlayers(players);
        }
      })
    );
  }

  join(room: RealtimeRoom) {
    if (this.room === room) {
      return;
    }
    if (this.room) {
      leaveRealtimeRoom(this.room);
    }
    this.room = room;
    joinRealtimeRoom(room, this.player.x, this.player.y);
  }

  update() {
    if (!this.room) {
      return;
    }

    const now = this.scene.time.now;
    if (now - this.lastSentAt < 80) {
      return;
    }

    const dx = this.player.x - this.lastX;
    const dy = this.player.y - this.lastY;
    if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5) {
      return;
    }

    this.lastSentAt = now;
    this.lastX = this.player.x;
    this.lastY = this.player.y;
    sendMovement({
      room: this.room,
      x: this.player.x,
      y: this.player.y,
      direction: this.direction(),
      animationState: this.isMoving() ? "walking" : "idle"
    });
  }

  stop() {
    if (!this.room) {
      return;
    }

    sendStop({
      room: this.room,
      x: this.player.x,
      y: this.player.y,
      direction: this.direction(),
      animationState: "idle"
    });
  }

  destroy() {
    this.stop();
    if (this.room) {
      leaveRealtimeRoom(this.room);
    }
    this.cleanup.forEach((fn) => fn());
    this.remotePlayers.destroy();
  }

  private isMoving() {
    const body = this.player.body as Phaser.Physics.Arcade.Body | null;
    return !!body && body.velocity.lengthSq() > 0;
  }

  private direction(): PlayerDirection {
    const body = this.player.body as Phaser.Physics.Arcade.Body | null;
    if (!body) {
      return "idle";
    }
    if (Math.abs(body.velocity.x) > Math.abs(body.velocity.y)) {
      return body.velocity.x < 0 ? "left" : "right";
    }
    if (Math.abs(body.velocity.y) > 0) {
      return body.velocity.y < 0 ? "up" : "down";
    }
    return "idle";
  }
}
