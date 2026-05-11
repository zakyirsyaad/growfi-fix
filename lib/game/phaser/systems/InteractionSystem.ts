import * as Phaser from "phaser";
import { gameEventBus, type GameInteractableType, type GameOverlayKey } from "@/lib/game/eventBus";
import type { InteractableObject } from "@/lib/game/phaser/objects/InteractableObject";
import type { Player } from "@/lib/game/phaser/objects/Player";

const INTERACTION_CHECK_INTERVAL_MS = 120;
const scenesWithInteractionInput = new WeakSet<Phaser.Scene>();

function defaultPriority(type: GameInteractableType) {
  if (type === "plot") {
    return 55;
  }
  return 50;
}

export class InteractionSystem {
  private staticInteractables = new Map<string, InteractableObject>();
  private dynamicInteractables = new Map<string, InteractableObject>();
  private interactableCache: InteractableObject[] = [];
  private cacheDirty = true;
  private active: InteractableObject | null = null;
  private activeId: string | null = null;
  private activePromptSignature = "";
  private candidates: InteractableObject[] = [];
  private nextCheckAt = 0;
  private manualSelectionUntil = 0;
  private text: Phaser.GameObjects.Text;
  private key?: Phaser.Input.Keyboard.Key;
  private spaceKey?: Phaser.Input.Keyboard.Key;
  private cycleKey?: Phaser.Input.Keyboard.Key;
  private inputLocks = new Set<string>();
  private destroyed = false;
  private cleanup: Array<() => void> = [];
  private onInteractKey = () => this.activate();
  private onCycleKey = () => this.cycleActive();

  constructor(private scene: Phaser.Scene, private player: Player) {
    if (scenesWithInteractionInput.has(scene)) {
      console.warn("[GrowFi] Duplicate InteractionSystem input listeners detected for scene", scene.scene.key);
    }
    scenesWithInteractionInput.add(scene);

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
    this.spaceKey = scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.cycleKey = scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.C);
    this.key?.on("down", this.onInteractKey);
    this.spaceKey?.on("down", this.onInteractKey);
    this.cycleKey?.on("down", this.onCycleKey);
    this.cleanup.push(
      gameEventBus.on("interact", () => this.activate()),
      gameEventBus.on("gameInputLockChanged", ({ source, locked }) => {
        if (locked) {
          this.inputLocks.add(source);
          this.setActive(null);
        } else {
          this.inputLocks.delete(source);
        }
      })
    );
  }

  setPlayer(player: Player) {
    this.player = player;
  }

  add(interactable: InteractableObject) {
    this.staticInteractables.set(interactable.id, interactable);
    this.cacheDirty = true;
  }

  upsertDynamic(interactable: InteractableObject) {
    this.dynamicInteractables.set(interactable.id, interactable);
    this.cacheDirty = true;
  }

  updateDynamicPosition(id: string, x: number, y: number, payload?: unknown) {
    const current = this.dynamicInteractables.get(id);
    if (!current) {
      return;
    }

    current.x = x;
    current.y = y;
    if (payload && current.action.kind === "overlay") {
      current.action.payload = payload;
    }
  }

  remove(id: string) {
    const removed = this.staticInteractables.delete(id) || this.dynamicInteractables.delete(id);
    if (!removed) {
      return;
    }

    this.cacheDirty = true;
    if (this.activeId === id) {
      this.setActive(null);
    }
  }

  removeByPrefix(prefix: string) {
    let removed = false;
    Array.from(this.staticInteractables.keys()).forEach((id) => {
      if (id.startsWith(prefix)) {
        this.staticInteractables.delete(id);
        removed = true;
      }
    });
    Array.from(this.dynamicInteractables.keys()).forEach((id) => {
      if (id.startsWith(prefix)) {
        this.dynamicInteractables.delete(id);
        removed = true;
      }
    });

    if (!removed) {
      return;
    }

    this.cacheDirty = true;
    if (this.activeId?.startsWith(prefix)) {
      this.setActive(null);
    }
  }

  clear() {
    this.staticInteractables.clear();
    this.dynamicInteractables.clear();
    this.interactableCache = [];
    this.cacheDirty = false;
    this.active = null;
    this.activeId = null;
    this.activePromptSignature = "";
    this.candidates = [];
    this.text.setVisible(false);
  }

  count() {
    return {
      static: this.staticInteractables.size,
      dynamic: this.dynamicInteractables.size,
      total: this.staticInteractables.size + this.dynamicInteractables.size
    };
  }

  update() {
    if (this.inputLocks.size > 0) {
      this.setActive(null);
      this.text.setVisible(false);
      return;
    }

    const now = this.scene.time.now;
    if (now >= this.nextCheckAt) {
      this.nextCheckAt = now + INTERACTION_CHECK_INTERVAL_MS;
      this.checkProximity(now);
    }

    if (this.active) {
      this.text.setPosition(this.active.x, this.active.y - 30).setVisible(true);
    } else {
      this.text.setVisible(false);
    }
  }

  activate() {
    if (this.inputLocks.size > 0 || !this.active) {
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
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.cleanup.forEach((fn) => fn());
    this.key?.off("down", this.onInteractKey);
    this.spaceKey?.off("down", this.onInteractKey);
    this.cycleKey?.off("down", this.onCycleKey);
    scenesWithInteractionInput.delete(this.scene);
    gameEventBus.emit("interactionPrompt", { visible: false });
    this.text.destroy();
  }

  private checkProximity(now: number) {
    if (this.inputLocks.size > 0) {
      this.setActive(null);
      return;
    }

    if (this.cacheDirty) {
      this.interactableCache = [
        ...this.staticInteractables.values(),
        ...this.dynamicInteractables.values()
      ];
      this.cacheDirty = false;
    }

    const playerX = this.player.x;
    const playerY = this.player.y;
    const candidates: Array<{ interactable: InteractableObject; distanceSq: number; priority: number }> = [];
    let best: { interactable: InteractableObject; distanceSq: number; priority: number } | null = null;

    for (const interactable of this.interactableCache) {
      const dx = playerX - interactable.x;
      const dy = playerY - interactable.y;
      const distanceSq = dx * dx + dy * dy;
      if (distanceSq > interactable.radius * interactable.radius) {
        continue;
      }

      const candidate = {
        interactable,
        distanceSq,
        priority: interactable.priority ?? defaultPriority(interactable.type)
      };
      candidates.push(candidate);

      if (
        !best ||
        candidate.priority > best.priority ||
        (candidate.priority === best.priority && candidate.distanceSq < best.distanceSq)
      ) {
        best = candidate;
      }
    }

    candidates.sort((a, b) => {
      if (b.priority !== a.priority) {
        return b.priority - a.priority;
      }
      return a.distanceSq - b.distanceSq;
    });

    this.candidates = candidates.map((candidate) => candidate.interactable);
    const manuallySelected =
      now < this.manualSelectionUntil
        ? this.candidates.find((candidate) => candidate.id === this.activeId)
        : null;
    this.setActive(manuallySelected || best?.interactable || null);
  }

  private cycleActive() {
    if (this.candidates.length <= 1 || !this.activeId) {
      return;
    }

    const currentIndex = this.candidates.findIndex((candidate) => candidate.id === this.activeId);
    const next = this.candidates[(currentIndex + 1) % this.candidates.length];
    this.manualSelectionUntil = this.scene.time.now + 1500;
    this.setActive(next);
  }

  private setActive(interactable: InteractableObject | null) {
    const nextSignature = interactable
      ? `${interactable.id}|${interactable.label}|${interactable.type}`
      : "";

    if (nextSignature === this.activePromptSignature) {
      this.active = interactable;
      this.activeId = interactable?.id ?? null;
      return;
    }

    this.active = interactable;
    this.activeId = interactable?.id ?? null;
    this.activePromptSignature = nextSignature;

    if (interactable) {
      this.text.setText(interactable.label);
      gameEventBus.emit("interactionPrompt", {
        visible: true,
        label: interactable.label,
        targetId: interactable.id,
        targetType: interactable.type
      });
    } else {
      gameEventBus.emit("interactionPrompt", { visible: false });
    }
  }
}
