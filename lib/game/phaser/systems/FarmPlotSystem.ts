import * as Phaser from "phaser";
import { INTERACTION_RADIUS, TILE_SIZE } from "@/lib/game/phaser/config/controls";
import { ASSET_KEYS } from "@/lib/game/phaser/config/assets";
import { gameEventBus } from "@/lib/game/eventBus";
import type { GardenPlotView, GardenResponse, PublicFarmResponse } from "@/types/game-data";
import type { InteractionSystem } from "@/lib/game/phaser/systems/InteractionSystem";

function textureForPlot(plot: GardenPlotView) {
  if (plot.plant?.visualStage) {
    const textures: Record<NonNullable<GardenPlotView["plant"]>["visualStage"] & string, string> = {
      empty: ASSET_KEYS.tiles.soilEmpty,
      locked: ASSET_KEYS.tiles.soilLocked,
      sprout: ASSET_KEYS.tiles.sprout,
      small: ASSET_KEYS.tiles.plantSmall,
      medium: ASSET_KEYS.tiles.plantMedium,
      ready: ASSET_KEYS.tiles.plantReady,
      regrowing: ASSET_KEYS.tiles.regrowing,
      dead: ASSET_KEYS.tiles.soilEmpty
    };
    return textures[plot.plant.visualStage] || ASSET_KEYS.tiles.soilEmpty;
  }
  if (plot.state === "LOCKED") {
    return ASSET_KEYS.tiles.soilLocked;
  }
  if (!plot.plant) {
    return ASSET_KEYS.tiles.soilEmpty;
  }
  if (plot.state === "READY" || plot.plant.state === "READY") {
    return ASSET_KEYS.tiles.plantReady;
  }
  if (plot.state === "REGROWING" || plot.plant.state === "REGROWING") {
    return ASSET_KEYS.tiles.regrowing;
  }

  const growCompleteAt = new Date(plot.plant.growCompleteAt).getTime();
  const plantedAt = Date.now() - (plot.plant.seed.growTimeSeconds || 300) * 1000;
  const progress = 1 - Math.max(0, growCompleteAt - Date.now()) / Math.max(1, growCompleteAt - plantedAt);
  if (progress > 0.66) {
    return ASSET_KEYS.tiles.plantMedium;
  }
  if (progress > 0.33) {
    return ASSET_KEYS.tiles.plantSmall;
  }
  return ASSET_KEYS.tiles.sprout;
}

function labelForPlot(plot: GardenPlotView, visitorMode: boolean) {
  if (visitorMode) {
    return `View ${plot.plant?.seed.name || "empty plot"}`;
  }
  if (plot.state === "EMPTY") {
    return "Press E to Plant";
  }
  if (plot.state === "READY") {
    return "Press E to Harvest";
  }
  if (plot.state === "GROWING") {
    return "Press E to Water";
  }
  if (plot.state === "REGROWING") {
    return "Press E to Check Regrow";
  }
  return "Locked Plot";
}

type PlotSpriteView = {
  sprite: Phaser.GameObjects.Sprite;
  iconText?: Phaser.GameObjects.Text;
  shine?: Phaser.GameObjects.Arc;
  signature: string;
};

function signatureForPlot(plot: GardenPlotView, texture: string) {
  return [
    texture,
    plot.state,
    plot.plant?.id || "empty",
    plot.plant?.state || "none",
    plot.plant?.visualStage || "auto",
    plot.plant?.seed.iconUrl || "",
    plot.plant?.permanentMutation || "NORMAL"
  ].join("|");
}

export class FarmPlotSystem {
  private group: Phaser.GameObjects.Group;
  private plotViews = new Map<string, PlotSpriteView>();
  private destroyed = false;

  constructor(
    private scene: Phaser.Scene,
    private interactionSystem: InteractionSystem,
    private originX: number,
    private originY: number
  ) {
    this.group = scene.add.group();
  }

  renderGarden(data: GardenResponse | PublicFarmResponse, visitorMode = false) {
    this.renderPlots(data, visitorMode);
  }

  async refreshFarmState(): Promise<GardenResponse | undefined> {
    if (this.destroyed || !this.isGroupAlive()) {
      return undefined;
    }

    gameEventBus.emit("refreshFarmState");
    return undefined;
  }

  renderPlots(data: GardenResponse | PublicFarmResponse, visitorMode = false) {
    if (this.destroyed || !this.isGroupAlive()) {
      return;
    }

    console.debug("[GrowFi] renderFarmPlots() called", {
      plots: data.garden.plots.length,
      visitorMode
    });

    const incomingIds = new Set(data.garden.plots.map((plot) => plot.id));
    Array.from(this.plotViews.keys()).forEach((plotId) => {
      if (!incomingIds.has(plotId)) {
        this.removePlotView(plotId);
      }
    });

    data.garden.plots.forEach((plot) => {
      this.updatePlotVisual(plot);
      this.registerPlotInteraction(plot, visitorMode);
    });

    console.debug("[GrowFi] interactables after renderFarmPlots()", this.interactionSystem.count());
  }

  clearPlots() {
    if (!this.isGroupAlive()) {
      return;
    }

    this.group.clear(true, true);
    this.plotViews.clear();
    this.interactionSystem.removeByPrefix("plot:");
  }

  updatePlotVisual(plot: GardenPlotView) {
    const { x, y } = this.plotPosition(plot);
    const texture = textureForPlot(plot);
    const signature = signatureForPlot(plot, texture);
    let view = this.plotViews.get(plot.id);

    if (!view) {
      const sprite = this.scene.add.sprite(x, y, texture).setDepth(5);
      sprite.setScale(1.2);
      this.group.add(sprite);
      view = { sprite, signature: "" };
      this.plotViews.set(plot.id, view);
    }

    view.sprite.setPosition(x, y);
    if (view.signature !== signature) {
      view.sprite.setTexture(texture);
      this.updateIcon(view, plot, x, y);
      this.updateShine(view, plot, x, y);
      view.signature = signature;
    } else {
      view.iconText?.setPosition(x, y - 2);
      view.shine?.setPosition(x + 13, y - 13);
    }
  }

  registerPlotInteractions(data: GardenResponse | PublicFarmResponse, visitorMode = false) {
    this.interactionSystem.removeByPrefix("plot:");
    data.garden.plots.forEach((plot) => this.registerPlotInteraction(plot, visitorMode));
  }

  destroy() {
    if (this.destroyed) {
      return;
    }

    this.destroyed = true;
    this.interactionSystem.removeByPrefix("plot:");
    this.plotViews.clear();

    if (!this.isGroupAlive()) {
      return;
    }

    this.group.destroy(true, true);
  }

  private isGroupAlive() {
    const group = this.group as Phaser.GameObjects.Group & {
      scene?: Phaser.Scene;
      children?: Phaser.Structs.Set<Phaser.GameObjects.GameObject>;
    };

    return !!group.scene && !!group.children;
  }

  private registerPlotInteraction(plot: GardenPlotView, visitorMode: boolean) {
    const { x, y } = this.plotPosition(plot);
    this.interactionSystem.add({
      id: `plot:${plot.id}`,
      type: "plot",
      x,
      y,
      radius: INTERACTION_RADIUS,
      priority: plot.state === "READY" || plot.plant?.state === "READY" ? 120 : 55,
      label: labelForPlot(plot, visitorMode),
      action: { kind: "plot", plotId: plot.id, visitorMode }
    });
  }

  private removePlotView(plotId: string) {
    const view = this.plotViews.get(plotId);
    if (!view) {
      return;
    }

    view.sprite.destroy();
    view.iconText?.destroy();
    view.shine?.destroy();
    this.plotViews.delete(plotId);
    this.interactionSystem.remove(`plot:${plotId}`);
  }

  private updateIcon(view: PlotSpriteView, plot: GardenPlotView, x: number, y: number) {
    const icon = plot.plant?.seed.iconUrl;
    if (!icon) {
      view.iconText?.destroy();
      view.iconText = undefined;
      return;
    }

    if (!view.iconText) {
      view.iconText = this.scene.add
        .text(x, y - 2, icon, {
          fontFamily: "Arial",
          fontSize: "18px"
        })
        .setOrigin(0.5)
        .setDepth(6);
      this.group.add(view.iconText);
      return;
    }

    view.iconText.setText(icon).setPosition(x, y - 2);
  }

  private updateShine(view: PlotSpriteView, plot: GardenPlotView, x: number, y: number) {
    const shouldShine = !!plot.plant?.permanentMutation && plot.plant.permanentMutation !== "NORMAL";
    if (!shouldShine) {
      view.shine?.destroy();
      view.shine = undefined;
      return;
    }

    if (!view.shine) {
      view.shine = this.scene.add.circle(x + 13, y - 13, 4, 0xf7d767, 0.95).setDepth(7);
      this.group.add(view.shine);
      return;
    }

    view.shine.setPosition(x + 13, y - 13);
  }

  private plotPosition(plot: GardenPlotView) {
    return {
      x: this.originX + plot.x * (TILE_SIZE + 9),
      y: this.originY + plot.y * (TILE_SIZE + 9)
    };
  }
}
