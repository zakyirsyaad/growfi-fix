import * as Phaser from "phaser";
import { gameEventBus, type GameOverlayKey } from "@/lib/game/eventBus";
import type { InteractableObject } from "@/lib/game/phaser/objects/InteractableObject";
import type { Player } from "@/lib/game/phaser/objects/Player";

export class InteractionSystem {
  private interactables = new Map<string, InteractableObject>();
  private active: InteractableObject | null = null;
  private text: Phaser.GameObjects.Text;
  private key?: Phaser.Input.Keyboard.Key;
  private cleanup: Array<() => void> = [];

  constructor(private scene: Phaser.Scene, private player: Player) {
    this.text = scene.add
      .text(0, 0, "", {
        fontFamily: "monospace",
        fontSize: "11px",
        color: "#203024",
        backgroundColor: "rgba(255, 252, 243, 0.9)",
        padding: { x: 7, y: 4 }
      })
      .setDepth(100)
      .setOrigin(0.5)
      .setVisible(false);

    this.key = scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.E);
    scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE).on("down", () => {
      this.activate();
    });
    this.key?.on("down", () => this.activate());
    this.cleanup.push(gameEventBus.on("interact", () => this.activate()));
  }

  setPlayer(player: Player) {
    this.player = player;
  }

  add(interactable: InteractableObject) {
    this.interactables.set(interactable.id, interactable);
  }

  removeByPrefix(prefix: string) {
    Array.from(this.interactables.keys()).forEach((id) => {
      if (id.startsWith(prefix)) {
        this.interactables.delete(id);
      }
    });
  }

  clear() {
    this.interactables.clear();
    this.active = null;
    this.text.setVisible(false);
  }

  update() {
    let nearest: InteractableObject | null = null;
    let nearestDistance = Number.POSITIVE_INFINITY;
    const playerPosition = new Phaser.Math.Vector2(this.player.x, this.player.y);

    for (const interactable of this.interactables.values()) {
      const distance = playerPosition.distance(new Phaser.Math.Vector2(interactable.x, interactable.y));
      if (distance <= interactable.radius && distance < nearestDistance) {
        nearest = interactable;
        nearestDistance = distance;
      }
    }

    if (nearest !== this.active) {
      this.active = nearest;
      if (nearest) {
        gameEventBus.emit("interactionPrompt", {
          visible: true,
          label: nearest.label,
          targetId: nearest.id,
          targetType: nearest.type
        });
      } else {
        gameEventBus.emit("interactionPrompt", { visible: false });
      }
    }

    if (nearest) {
      this.text
        .setText(nearest.label)
        .setPosition(nearest.x, nearest.y - 30)
        .setVisible(true);
    } else {
      this.text.setVisible(false);
    }
  }

  activate() {
    if (!this.active) {
      return;
    }

    const action = this.active.action;
    if (action.kind === "overlay") {
      gameEventBus.emit("openOverlay", {
        overlay: action.overlay as GameOverlayKey,
        payload: action.payload
      });
      return;
    }

    if (action.kind === "plot") {
      gameEventBus.emit("selectPlot", {
        plotId: action.plotId,
        visitorMode: action.visitorMode
      });
      return;
    }

    if (action.kind === "map") {
      if (action.map === "town") {
        this.scene.scene.start("TownScene");
      } else {
        this.scene.scene.start("FarmScene", { visitorMode: false });
      }
      return;
    }

    if (action.kind === "event") {
      gameEventBus.emit(action.event);
      return;
    }

    if (action.kind === "toast") {
      gameEventBus.emit("actionToast", {
        title: action.title,
        description: action.description
      });
    }
  }

  destroy() {
    this.cleanup.forEach((fn) => fn());
    this.text.destroy();
  }
}
