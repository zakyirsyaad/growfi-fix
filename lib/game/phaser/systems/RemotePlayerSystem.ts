import * as Phaser from "phaser";
import { INTERACTION_RADIUS } from "@/lib/game/phaser/config/controls";
import { ASSET_KEYS } from "@/lib/game/phaser/config/assets";
import type { InteractionSystem } from "@/lib/game/phaser/systems/InteractionSystem";
import type { OnlinePlayer } from "@/lib/realtime/types";

type RemotePlayerView = {
  player: OnlinePlayer;
  sprite: Phaser.GameObjects.Sprite;
  label: Phaser.GameObjects.Text;
  target: Phaser.Math.Vector2;
};

export class RemotePlayerSystem {
  private players = new Map<string, RemotePlayerView>();

  constructor(private scene: Phaser.Scene, private interactionSystem: InteractionSystem) {}

  setPlayers(players: OnlinePlayer[]) {
    const incomingIds = new Set(players.map((player) => player.userId));
    for (const userId of Array.from(this.players.keys())) {
      if (!incomingIds.has(userId)) {
        this.removePlayer(userId);
      }
    }

    players.forEach((player) => this.upsertPlayer(player));
    this.registerInteractions();
  }

  upsertPlayer(player: OnlinePlayer) {
    const existing = this.players.get(player.userId);
    if (existing) {
      existing.player = player;
      existing.target.set(player.x, player.y);
      existing.label.setText(player.username);
      existing.sprite.setFlipX(player.direction === "left");
      return;
    }

    const sprite = this.scene.add.sprite(player.x, player.y, ASSET_KEYS.characters.player).setDepth(19);
    sprite.setTint(0x77b7ff);
    const label = this.scene.add
      .text(player.x, player.y - 34, player.username, {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#203024",
        backgroundColor: "rgba(255,252,243,0.86)",
        padding: { x: 6, y: 3 }
      })
      .setOrigin(0.5)
      .setDepth(101);

    this.players.set(player.userId, {
      player,
      sprite,
      label,
      target: new Phaser.Math.Vector2(player.x, player.y)
    });
  }

  removePlayer(userId: string) {
    const view = this.players.get(userId);
    if (!view) {
      return;
    }

    view.sprite.destroy();
    view.label.destroy();
    this.players.delete(userId);
    this.interactionSystem.removeByPrefix(`remote:${userId}`);
  }

  update() {
    for (const view of this.players.values()) {
      view.sprite.x = Phaser.Math.Linear(view.sprite.x, view.target.x, 0.22);
      view.sprite.y = Phaser.Math.Linear(view.sprite.y, view.target.y, 0.22);
      view.label.setPosition(view.sprite.x, view.sprite.y - 34);
    }
    this.registerInteractions();
  }

  destroy() {
    this.interactionSystem.removeByPrefix("remote:");
    for (const userId of Array.from(this.players.keys())) {
      this.removePlayer(userId);
    }
  }

  private registerInteractions() {
    this.interactionSystem.removeByPrefix("remote:");
    for (const view of this.players.values()) {
      this.interactionSystem.add({
        id: `remote:${view.player.userId}`,
        type: "remotePlayer",
        x: view.sprite.x,
        y: view.sprite.y,
        radius: INTERACTION_RADIUS,
        label: `Press E to interact with ${view.player.username}`,
        action: {
          kind: "overlay",
          overlay: "playerInteraction",
          payload: view.player
        }
      });
    }
  }
}
