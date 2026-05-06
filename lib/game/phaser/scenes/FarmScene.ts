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

  constructor() {
    super("FarmScene");
  }

  init(data: FarmSceneData) {
    this.visitorMode = !!data.visitorMode;
    this.visitorFarm = data.farm;
  }

  create() {
    const map = MAPS.farm;
    this.physics.world.setBounds(0, 0, map.width, map.height);
    this.drawGround(map.width, map.height);
    this.obstacles = this.physics.add.staticGroup();

    const house = this.obstacles.create(300, 160, ASSET_KEYS.objects.house) as Phaser.Physics.Arcade.Sprite;
    house.setDepth(4);
    house.body?.setSize(120, 70);
    house.body?.setOffset(6, 23);
    house.refreshBody();

    const mailbox = this.add.sprite(430, 260, ASSET_KEYS.objects.mailbox).setDepth(7);
    this.add.text(234, 222, this.visitorMode ? "Guest Spawn" : "Home", {
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
            this.multiplayer.join(`farm:${garden.user.id}`);
          }
        }
      }),
      gameEventBus.on("refreshFarmState", () => {
        if (!this.visitorMode) {
          this.refreshFarmState();
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

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cleanup.forEach((fn) => fn());
      this.cleanup = [];
      this.controller?.destroy();
      this.plotSystem?.destroy();
      this.multiplayer?.destroy();
      this.presence?.destroy();
      this.interactionSystem?.destroy();
    });
  }

  update() {
    this.controller?.update();
    this.interactionSystem?.update();
    this.transitions?.update();
    this.remotePlayers?.update();
    this.multiplayer?.update();
  }

  private async refreshFarmState() {
    const garden = await this.plotSystem.refreshFarmState();
    if (garden?.user.id) {
      this.multiplayer.join(`farm:${garden.user.id}`);
    }
  }

  private addFarmObjectInteractions() {
    this.interactionSystem.add({
      id: "farm-board",
      type: "farmBoard",
      x: 520,
      y: 276,
      radius: INTERACTION_RADIUS,
      label: "Press E to manage Farm",
      action: { kind: "overlay", overlay: "farmUpgrade" }
    });
    this.interactionSystem.add({
      id: "storage-chest",
      type: "storageChest",
      x: 392,
      y: 322,
      radius: INTERACTION_RADIUS,
      label: "Press E to open Storage",
      action: { kind: "overlay", overlay: "inventory" }
    });
    this.interactionSystem.add({
      id: "water-well",
      type: "waterWell",
      x: 510,
      y: 410,
      radius: INTERACTION_RADIUS,
      label: "Press E to refill Watering Can",
      action: { kind: "event", event: "refillWater" }
    });
    this.interactionSystem.add({
      id: "quest-board",
      type: "questBoard",
      x: 250,
      y: 356,
      radius: INTERACTION_RADIUS,
      label: "Press E to open Daily Quests",
      action: { kind: "overlay", overlay: "questBoard" }
    });
    this.interactionSystem.add({
      id: "scarecrow",
      type: "scarecrow",
      x: 585,
      y: 555,
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
      x: 990,
      y: 750,
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
      x: 214,
      y: 510,
      radius: INTERACTION_RADIUS,
      label: "Press E to inspect Pet Area",
      action: {
        kind: "toast",
        title: "Pet helper coming soon",
        description: "This corner is reserved for future pet/helper upgrades."
      }
    });
  }

  private drawGround(width: number, height: number) {
    for (let y = 0; y < height; y += TILE_SIZE) {
      for (let x = 0; x < width; x += TILE_SIZE) {
        this.add.image(x + TILE_SIZE / 2, y + TILE_SIZE / 2, ASSET_KEYS.tiles.grass).setDepth(0);
      }
    }

    for (let x = 280; x < 1370; x += TILE_SIZE) {
      this.add.image(x, 520, ASSET_KEYS.tiles.path).setDepth(1);
    }
    for (let y = 195; y < 530; y += TILE_SIZE) {
      this.add.image(318, y, ASSET_KEYS.tiles.path).setDepth(1);
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

    const water = this.obstacles.create(990, 750, ASSET_KEYS.tiles.water) as Phaser.Physics.Arcade.Sprite;
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
    this.add.sprite(520, 276, ASSET_KEYS.objects.farmBoard).setDepth(8);
    this.add.sprite(392, 322, ASSET_KEYS.objects.storageChest).setDepth(8);
    this.add.sprite(510, 410, ASSET_KEYS.objects.waterWell).setDepth(8);
    this.add.sprite(250, 356, ASSET_KEYS.objects.questBoard).setDepth(8);
    this.add.sprite(585, 555, ASSET_KEYS.objects.scarecrow).setDepth(8);
    this.add.sprite(214, 510, ASSET_KEYS.objects.petArea).setDepth(8);

    [
      [150, 160],
      [206, 150],
      [1190, 160],
      [1244, 202],
      [132, 740],
      [310, 775],
      [1196, 830]
    ].forEach(([x, y]) => this.add.sprite(x, y, ASSET_KEYS.objects.tree).setDepth(4));

    [
      [170, 320],
      [232, 628],
      [520, 720],
      [1140, 690],
      [1240, 336],
      [760, 262]
    ].forEach(([x, y]) => this.add.sprite(x, y, ASSET_KEYS.objects.bush).setDepth(5));

    [
      [374, 436],
      [420, 516],
      [560, 462],
      [742, 732],
      [848, 284],
      [1070, 540],
      [1180, 544]
    ].forEach(([x, y]) => this.add.sprite(x, y, ASSET_KEYS.objects.flower).setDepth(5));

    [
      [692, 250],
      [912, 286],
      [1088, 820],
      [360, 690]
    ].forEach(([x, y]) => this.add.sprite(x, y, ASSET_KEYS.objects.rock).setDepth(5));

    this.add.text(274, 444, "Visitor Spawn", {
      fontFamily: "monospace",
      fontSize: "11px",
      color: "#203024",
      backgroundColor: "rgba(255,252,243,0.8)",
      padding: { x: 7, y: 3 }
    }).setDepth(8);
  }
}
