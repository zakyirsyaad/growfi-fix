import * as Phaser from "phaser";
import { gameEventBus } from "@/lib/game/eventBus";
import { ASSET_KEYS } from "@/lib/game/phaser/config/assets";
import { MAPS } from "@/lib/game/phaser/config/maps";
import { TILE_SIZE, INTERACTION_RADIUS } from "@/lib/game/phaser/config/controls";
import { Player } from "@/lib/game/phaser/objects/Player";
import { PlayerController } from "@/lib/game/phaser/systems/PlayerController";
import { InteractionSystem } from "@/lib/game/phaser/systems/InteractionSystem";
import { FarmPlotSystem } from "@/lib/game/phaser/systems/FarmPlotSystem";
import { MapTransitionSystem } from "@/lib/game/phaser/systems/MapTransitionSystem";
import { MultiplayerSystem } from "@/lib/game/phaser/systems/MultiplayerSystem";
import { PresenceSystem } from "@/lib/game/phaser/systems/PresenceSystem";
import { RemotePlayerSystem } from "@/lib/game/phaser/systems/RemotePlayerSystem";
import { configureCamera } from "@/lib/game/phaser/systems/CameraSystem";
import type { GardenResponse, PublicFarmResponse } from "@/types/game-data";

type FarmSceneData = {
  visitorMode?: boolean;
  farm?: PublicFarmResponse;
};

const FARM_OBJECTS = {
  mailbox: { x: 430, y: 238 },
  walletBank: { x: 472, y: 184 },
  farmBoard: { x: 526, y: 268 },
  seedShop: { x: 1050, y: 188 },
  marketBoard: { x: 1005, y: 336 },
  tradeBoard: { x: 1156, y: 336 },
  storageChest: { x: 426, y: 704 },
  waterWell: { x: 282, y: 696 },
  questBoard: { x: 236, y: 588 },
  scarecrow: { x: 844, y: 724 },
  pond: { x: 1036, y: 754 },
  petArea: { x: 1190, y: 720 },
  visitorSpawn: { x: 1190, y: 590 }
} as const;

let activeFarmSceneInstances = 0;

export class FarmScene extends Phaser.Scene {
  private player!: Player;
  private controller!: PlayerController;
  private interactionSystem!: InteractionSystem;
  private plotSystem!: FarmPlotSystem;
  private transitions!: MapTransitionSystem;
  private remotePlayers!: RemotePlayerSystem;
  private multiplayer!: MultiplayerSystem;
  private presence!: PresenceSystem;
  private obstacles!: Phaser.Physics.Arcade.StaticGroup;
  private cleanup: Array<() => void> = [];
  private visitorMode = false;
  private visitorFarm?: PublicFarmResponse;
  private fpsText?: Phaser.GameObjects.Text;
  private nextFpsUpdateAt = 0;

  constructor() {
    super("FarmScene");
  }

  init(data: FarmSceneData) {
    this.visitorMode = !!data.visitorMode;
    this.visitorFarm = data.farm;
  }

  create() {
    activeFarmSceneInstances += 1;
    console.debug("[GrowFi] Home Farm scene create", {
      activeFarmSceneInstances,
      visitorMode: this.visitorMode
    });
    if (activeFarmSceneInstances > 1) {
      console.warn("[GrowFi] Duplicate Home Farm scene instance detected", activeFarmSceneInstances);
    }

    const map = MAPS.farm;
    this.physics.world.setBounds(0, 0, map.width, map.height);
    this.drawGround(map.width, map.height);
    this.obstacles = this.physics.add.staticGroup();

    const house = this.obstacles.create(300, 160, ASSET_KEYS.objects.house) as Phaser.Physics.Arcade.Sprite;
    house.setDepth(4);
    house.body?.setSize(120, 70);
    house.body?.setOffset(6, 23);
    house.refreshBody();

    const mailbox = this.add.sprite(FARM_OBJECTS.mailbox.x, FARM_OBJECTS.mailbox.y, ASSET_KEYS.objects.mailbox).setDepth(7);
    this.add.text(234, 222, this.visitorMode ? "Guest Spawn" : "Home Farm", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#203024",
      backgroundColor: "rgba(255,255,255,0.65)",
      padding: { x: 6, y: 3 }
    }).setDepth(8);

    this.drawFarmEdges();
    this.drawFarmDecorations();
    this.player = new Player(this, map.spawn.x, map.spawn.y);
    this.physics.add.collider(this.player, this.obstacles);
    this.cleanup.push(configureCamera(this, this.player));

    this.controller = new PlayerController(this, this.player);
    this.interactionSystem = new InteractionSystem(this, this.player);
    this.plotSystem = new FarmPlotSystem(this, this.interactionSystem, 610, 315);
    this.transitions = new MapTransitionSystem(this, this.player);
    this.remotePlayers = new RemotePlayerSystem(this, this.interactionSystem);
    this.multiplayer = new MultiplayerSystem(this, this.player, this.remotePlayers);
    this.presence = new PresenceSystem();

    this.interactionSystem.add({
      id: "mailbox",
      type: "mailbox",
      x: mailbox.x,
      y: mailbox.y,
      radius: INTERACTION_RADIUS,
      label: "Press E to open Activity Log",
      action: { kind: "overlay", overlay: "activityLog" }
    });

    this.addFarmObjectInteractions();

    this.interactionSystem.add({
      id: "farm-exit",
      type: "homeExit",
      x: 1300,
      y: 520,
      radius: 76,
      label: "Press E to walk to Town",
      action: { kind: "map", map: "town" }
    });
    this.logInteractableCounts("Home Farm static interactables registered");

    this.transitions.add({
      id: "walk-to-town",
      rect: new Phaser.Geom.Rectangle(1340, 420, 60, 190),
      onEnter: () => this.scene.start("TownScene")
    });

    this.cleanup.push(
      gameEventBus.on("gardenStateUpdated", (payload) => {
        if (!this.visitorMode) {
          const garden = payload as GardenResponse;
          this.plotSystem.renderGarden(garden, false);
          if (garden.user.id) {
            this.multiplayer.join(`home:${garden.user.id}`);
          }
        }
      }),
      gameEventBus.on("visitorFarmLoaded", (payload) => {
        this.scene.start("FarmScene", {
          visitorMode: true,
          farm: payload as PublicFarmResponse
        });
      }),
      gameEventBus.on("returnHome", () => {
        this.scene.start("FarmScene", { visitorMode: false });
      })
    );

    if (this.visitorMode && this.visitorFarm) {
      this.add.text(585, 238, `${this.visitorFarm.owner.username}'s Farm`, {
        fontFamily: "monospace",
        fontSize: "13px",
        color: "#203024",
        backgroundColor: "rgba(255,252,243,0.9)",
        padding: { x: 8, y: 4 }
      }).setDepth(9);
      this.interactionSystem.add({
        id: "visitor-trade",
        type: "trade",
        x: 470,
        y: 312,
        radius: INTERACTION_RADIUS,
        label: `Press E to trade with ${this.visitorFarm.owner.username}`,
        action: {
          kind: "overlay",
          overlay: "trade",
          payload: { recipientId: this.visitorFarm.owner.id, recipientUsername: this.visitorFarm.owner.username }
        }
      });
      this.plotSystem.renderGarden(this.visitorFarm, true);
      this.multiplayer.join(`farm:${this.visitorFarm.owner.id}`);
      gameEventBus.emit("areaChanged", {
        area: "Other User Farm",
        visitorMode: true,
        ownerName: this.visitorFarm.owner.username
      });
    } else {
      gameEventBus.emit("areaChanged", { area: "Home Farm", visitorMode: false });
      this.refreshFarmState();
    }

    this.addDebugFpsMeter();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      console.debug("[GrowFi] Home Farm scene shutdown", {
        activeFarmSceneInstances,
        interactables: this.interactionSystem?.count()
      });
      this.cleanup.forEach((fn) => fn());
      this.cleanup = [];
      this.controller?.destroy();
      this.plotSystem?.destroy();
      this.multiplayer?.destroy();
      this.presence?.destroy();
      this.interactionSystem?.destroy();
      this.fpsText?.destroy();
      this.obstacles?.clear(true, true);
      this.obstacles?.destroy();
      activeFarmSceneInstances = Math.max(0, activeFarmSceneInstances - 1);
    });
  }

  update() {
    this.controller?.update();
    this.interactionSystem?.update();
    this.transitions?.update();
    this.remotePlayers?.update();
    this.multiplayer?.update();
    this.updateDebugFps();
  }

  private async refreshFarmState() {
    console.debug("[GrowFi] FarmScene.refreshFarmState() called", {
      visitorMode: this.visitorMode
    });
    const garden = await this.plotSystem.refreshFarmState();
    if (garden?.user.id) {
      this.multiplayer.join(`home:${garden.user.id}`);
    }
  }

  private addFarmObjectInteractions() {
    this.interactionSystem.add({
      id: "seed-shop-stall",
      type: "shop",
      x: FARM_OBJECTS.seedShop.x,
      y: FARM_OBJECTS.seedShop.y + 58,
      radius: 88,
      label: "Press E to open Seed Shop",
      action: { kind: "overlay", overlay: "seedShop" }
    });
    this.interactionSystem.add({
      id: "wallet-bank",
      type: "wallet",
      x: FARM_OBJECTS.walletBank.x,
      y: FARM_OBJECTS.walletBank.y,
      radius: INTERACTION_RADIUS,
      label: "Press E to open Wallet",
      action: { kind: "overlay", overlay: "wallet" }
    });
    this.interactionSystem.add({
      id: "marketplace-board",
      type: "marketplace",
      x: FARM_OBJECTS.marketBoard.x,
      y: FARM_OBJECTS.marketBoard.y,
      radius: INTERACTION_RADIUS,
      label: "Press E to open Marketplace",
      action: { kind: "overlay", overlay: "marketplace" }
    });
    this.interactionSystem.add({
      id: "trade-board",
      type: "trade",
      x: FARM_OBJECTS.tradeBoard.x,
      y: FARM_OBJECTS.tradeBoard.y,
      radius: INTERACTION_RADIUS,
      label: "Press E to open Trade Board",
      action: { kind: "overlay", overlay: "trade" }
    });
    this.interactionSystem.add({
      id: "farm-board",
      type: "farmBoard",
      x: FARM_OBJECTS.farmBoard.x,
      y: FARM_OBJECTS.farmBoard.y,
      radius: INTERACTION_RADIUS,
      label: "Press E to manage Farm",
      action: { kind: "overlay", overlay: "farmUpgrade" }
    });
    this.interactionSystem.add({
      id: "storage-chest",
      type: "storageChest",
      x: FARM_OBJECTS.storageChest.x,
      y: FARM_OBJECTS.storageChest.y,
      radius: INTERACTION_RADIUS,
      label: "Press E to open Storage",
      action: { kind: "overlay", overlay: "inventory" }
    });
    this.interactionSystem.add({
      id: "water-well",
      type: "waterWell",
      x: FARM_OBJECTS.waterWell.x,
      y: FARM_OBJECTS.waterWell.y,
      radius: INTERACTION_RADIUS,
      label: "Press E to refill Watering Can",
      action: { kind: "event", event: "refillWater" }
    });
    this.interactionSystem.add({
      id: "quest-board",
      type: "questBoard",
      x: FARM_OBJECTS.questBoard.x,
      y: FARM_OBJECTS.questBoard.y,
      radius: INTERACTION_RADIUS,
      label: "Press E to open Daily Quests",
      action: { kind: "overlay", overlay: "questBoard" }
    });
    this.interactionSystem.add({
      id: "scarecrow",
      type: "scarecrow",
      x: FARM_OBJECTS.scarecrow.x,
      y: FARM_OBJECTS.scarecrow.y,
      radius: INTERACTION_RADIUS,
      label: "Press E to inspect Scarecrow",
      action: {
        kind: "toast",
        title: "Scarecrow bonus",
        description: "Farm protection and crop bonus upgrades are coming later."
      }
    });
    this.interactionSystem.add({
      id: "pond",
      type: "pond",
      x: FARM_OBJECTS.pond.x,
      y: FARM_OBJECTS.pond.y,
      radius: 110,
      label: "Press E to inspect Pond",
      action: {
        kind: "toast",
        title: "Fishing coming soon",
        description: "The pond is decorative in this MVP."
      }
    });
    this.interactionSystem.add({
      id: "pet-area",
      type: "petArea",
      x: FARM_OBJECTS.petArea.x,
      y: FARM_OBJECTS.petArea.y,
      radius: INTERACTION_RADIUS,
      label: "Press E to inspect Pet Area",
      action: {
        kind: "toast",
        title: "Pet helper coming soon",
        description: "This corner is reserved for future pet/helper upgrades."
      }
    });
  }

  private logInteractableCounts(message: string) {
    console.debug("[GrowFi]", message, this.interactionSystem.count());
  }

  private addDebugFpsMeter() {
    if (typeof window === "undefined" || window.localStorage.getItem("growfi:debugFps") !== "1") {
      return;
    }

    this.fpsText = this.add
      .text(14, 14, "FPS", {
        fontFamily: "monospace",
        fontSize: "12px",
        color: "#203024",
        backgroundColor: "rgba(255,252,243,0.85)",
        padding: { x: 6, y: 3 }
      })
      .setScrollFactor(0)
      .setDepth(200);
  }

  private updateDebugFps() {
    if (!this.fpsText || this.time.now < this.nextFpsUpdateAt) {
      return;
    }

    this.nextFpsUpdateAt = this.time.now + 500;
    this.fpsText.setText(`FPS ${Math.round(this.game.loop.actualFps)}`);
  }

  private drawGround(width: number, height: number) {
    for (let y = 0; y < height; y += TILE_SIZE) {
      for (let x = 0; x < width; x += TILE_SIZE) {
        this.add.image(x + TILE_SIZE / 2, y + TILE_SIZE / 2, ASSET_KEYS.tiles.grass).setDepth(0);
      }
    }

    for (let x = 250; x < 1370; x += TILE_SIZE) {
      this.add.image(x, 520, ASSET_KEYS.tiles.path).setDepth(1);
    }
    for (let y = 195; y < 735; y += TILE_SIZE) {
      this.add.image(318, y, ASSET_KEYS.tiles.path).setDepth(1);
    }
    for (let x = 430; x < 1230; x += TILE_SIZE) {
      this.add.image(x, 336, ASSET_KEYS.tiles.path).setDepth(1);
    }
    for (let y = 205; y < 382; y += TILE_SIZE) {
      this.add.image(1050, y, ASSET_KEYS.tiles.path).setDepth(1);
    }
    for (let x = 208; x < 475; x += TILE_SIZE) {
      this.add.image(x, 696, ASSET_KEYS.tiles.path).setDepth(1);
    }
  }

  private drawFarmEdges() {
    for (let x = 20; x < 1360; x += TILE_SIZE) {
      this.add.image(x, 70, ASSET_KEYS.tiles.fence).setDepth(3);
      this.add.image(x, 890, ASSET_KEYS.tiles.fence).setDepth(3);
    }
    for (let y = 90; y < 890; y += TILE_SIZE) {
      this.add.image(48, y, ASSET_KEYS.tiles.fence).setDepth(3);
      if (y < 430 || y > 610) {
        this.add.image(1344, y, ASSET_KEYS.tiles.fence).setDepth(3);
      }
    }

    const water = this.obstacles.create(FARM_OBJECTS.pond.x, FARM_OBJECTS.pond.y, ASSET_KEYS.tiles.water) as Phaser.Physics.Arcade.Sprite;
    water.setDisplaySize(210, 96).setDepth(2);
    water.body?.setSize(210, 96);
    water.refreshBody();

    this.add.text(1275, 468, "Town", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#203024",
      backgroundColor: "rgba(255,252,243,0.9)",
      padding: { x: 8, y: 4 }
    }).setDepth(8);
  }

  private drawFarmDecorations() {
    this.add.sprite(FARM_OBJECTS.walletBank.x, FARM_OBJECTS.walletBank.y, ASSET_KEYS.objects.bank).setDepth(8);
    this.add.sprite(FARM_OBJECTS.farmBoard.x, FARM_OBJECTS.farmBoard.y, ASSET_KEYS.objects.farmBoard).setDepth(8);
    this.add.sprite(FARM_OBJECTS.seedShop.x, FARM_OBJECTS.seedShop.y, ASSET_KEYS.objects.shop).setDepth(8);
    this.add.sprite(FARM_OBJECTS.marketBoard.x, FARM_OBJECTS.marketBoard.y, ASSET_KEYS.objects.marketBoard).setDepth(8);
    this.add.sprite(FARM_OBJECTS.tradeBoard.x, FARM_OBJECTS.tradeBoard.y, ASSET_KEYS.objects.tradeBoard).setDepth(8);
    this.add.sprite(FARM_OBJECTS.storageChest.x, FARM_OBJECTS.storageChest.y, ASSET_KEYS.objects.storageChest).setDepth(8);
    this.add.sprite(FARM_OBJECTS.waterWell.x, FARM_OBJECTS.waterWell.y, ASSET_KEYS.objects.waterWell).setDepth(8);
    this.add.sprite(FARM_OBJECTS.questBoard.x, FARM_OBJECTS.questBoard.y, ASSET_KEYS.objects.questBoard).setDepth(8);
    this.add.sprite(FARM_OBJECTS.scarecrow.x, FARM_OBJECTS.scarecrow.y, ASSET_KEYS.objects.scarecrow).setDepth(8);
    this.add.sprite(FARM_OBJECTS.petArea.x, FARM_OBJECTS.petArea.y, ASSET_KEYS.objects.petArea).setDepth(8);

    [
      [150, 160],
      [206, 150],
      [1190, 160],
      [1244, 202],
      [132, 740],
      [310, 775],
      [1196, 830],
      [1290, 660]
    ].forEach(([x, y]) => this.add.sprite(x, y, ASSET_KEYS.objects.tree).setDepth(4));

    [
      [170, 320],
      [232, 628],
      [520, 720],
      [1140, 690],
      [1240, 336],
      [760, 262],
      [932, 218],
      [1230, 478]
    ].forEach(([x, y]) => this.add.sprite(x, y, ASSET_KEYS.objects.bush).setDepth(5));

    [
      [374, 436],
      [420, 516],
      [560, 462],
      [742, 732],
      [848, 284],
      [1070, 540],
      [1180, 544],
      [914, 350],
      [1226, 292],
      [270, 642]
    ].forEach(([x, y]) => this.add.sprite(x, y, ASSET_KEYS.objects.flower).setDepth(5));

    [
      [692, 250],
      [912, 286],
      [1088, 820],
      [360, 690]
    ].forEach(([x, y]) => this.add.sprite(x, y, ASSET_KEYS.objects.rock).setDepth(5));

    this.add.text(FARM_OBJECTS.visitorSpawn.x - 56, FARM_OBJECTS.visitorSpawn.y - 40, "Visitor Spawn", {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#203024",
      backgroundColor: "rgba(255,252,243,0.8)",
      padding: { x: 7, y: 3 }
    }).setDepth(8);
  }
}
