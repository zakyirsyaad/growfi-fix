import * as Phaser from "phaser";
import { gameEventBus } from "@/lib/game/eventBus";
import { ASSET_KEYS } from "@/lib/game/phaser/config/assets";
import { MAPS } from "@/lib/game/phaser/config/maps";
import { TILE_SIZE, INTERACTION_RADIUS } from "@/lib/game/phaser/config/controls";
import { Player } from "@/lib/game/phaser/objects/Player";
import { PlayerController } from "@/lib/game/phaser/systems/PlayerController";
import { InteractionSystem } from "@/lib/game/phaser/systems/InteractionSystem";
import { MapTransitionSystem } from "@/lib/game/phaser/systems/MapTransitionSystem";
import { MultiplayerSystem } from "@/lib/game/phaser/systems/MultiplayerSystem";
import { PresenceSystem } from "@/lib/game/phaser/systems/PresenceSystem";
import { RemotePlayerSystem } from "@/lib/game/phaser/systems/RemotePlayerSystem";
import { configureCamera } from "@/lib/game/phaser/systems/CameraSystem";
import type { PublicFarmResponse } from "@/types/game-data";

export class TownScene extends Phaser.Scene {
  private player!: Player;
  private controller!: PlayerController;
  private interactionSystem!: InteractionSystem;
  private transitions!: MapTransitionSystem;
  private remotePlayers!: RemotePlayerSystem;
  private multiplayer!: MultiplayerSystem;
  private presence!: PresenceSystem;
  private obstacles!: Phaser.Physics.Arcade.StaticGroup;
  private cleanup: Array<() => void> = [];

  constructor() {
    super("TownScene");
  }

  create() {
    const map = MAPS.town;
    this.physics.world.setBounds(0, 0, map.width, map.height);
    this.drawGround(map.width, map.height);
    this.obstacles = this.physics.add.staticGroup();

    const shop = this.addStaticObject(390, 190, ASSET_KEYS.objects.shop, 136, 80, 8, 30);
    const marketBoard = this.add.sprite(720, 440, ASSET_KEYS.objects.marketBoard).setDepth(6);
    const tradeBoard = this.add.sprite(870, 440, ASSET_KEYS.objects.tradeBoard).setDepth(6);
    const bank = this.add.sprite(560, 440, ASSET_KEYS.objects.bank).setDepth(6);
    const portal = this.add.sprite(1045, 430, ASSET_KEYS.objects.portal).setDepth(6);
    const leaderboard = this.add.sprite(735, 210, ASSET_KEYS.objects.leaderboard).setDepth(6);
    this.add.sprite(345, 310, ASSET_KEYS.characters.npc).setDepth(9);

    this.player = new Player(this, map.spawn.x, map.spawn.y);
    this.physics.add.collider(this.player, this.obstacles);
    this.cleanup.push(configureCamera(this, this.player));

    this.controller = new PlayerController(this, this.player);
    this.interactionSystem = new InteractionSystem(this, this.player);
    this.transitions = new MapTransitionSystem(this, this.player);
    this.remotePlayers = new RemotePlayerSystem(this, this.interactionSystem);
    this.multiplayer = new MultiplayerSystem(this, this.player, this.remotePlayers);
    this.presence = new PresenceSystem();
    this.multiplayer.join("town");

    this.interactionSystem.add({
      id: "seed-shop",
      type: "shop",
      x: shop.x,
      y: shop.y + 68,
      radius: 90,
      label: "Press E to open Seed Shop",
      action: { kind: "overlay", overlay: "seedShop" }
    });
    this.interactionSystem.add({
      id: "market-board",
      type: "marketplace",
      x: marketBoard.x,
      y: marketBoard.y,
      radius: INTERACTION_RADIUS,
      label: "Press E to open Marketplace",
      action: { kind: "overlay", overlay: "marketplace" }
    });
    this.interactionSystem.add({
      id: "trade-board",
      type: "trade",
      x: tradeBoard.x,
      y: tradeBoard.y,
      radius: INTERACTION_RADIUS,
      label: "Press E to open Direct Trade",
      action: { kind: "overlay", overlay: "trade" }
    });
    this.interactionSystem.add({
      id: "wallet-bank",
      type: "wallet",
      x: bank.x,
      y: bank.y,
      radius: INTERACTION_RADIUS,
      label: "Press E to open Wallet",
      action: { kind: "overlay", overlay: "wallet" }
    });
    this.interactionSystem.add({
      id: "farm-portal",
      type: "visitFarm",
      x: portal.x,
      y: portal.y,
      radius: INTERACTION_RADIUS,
      label: "Press E to visit another farm",
      action: { kind: "overlay", overlay: "visitFarm" }
    });
    this.interactionSystem.add({
      id: "leaderboard",
      type: "leaderboard",
      x: leaderboard.x,
      y: leaderboard.y,
      radius: INTERACTION_RADIUS,
      label: "Press E to view Leaderboard",
      action: { kind: "overlay", overlay: "leaderboard" }
    });
    this.interactionSystem.add({
      id: "town-home-path",
      type: "townExit",
      x: 700,
      y: 875,
      radius: 90,
      label: "Press E to return Home",
      action: { kind: "map", map: "farm" }
    });

    this.transitions.add({
      id: "walk-home",
      rect: new Phaser.Geom.Rectangle(620, 910, 160, 82),
      onEnter: () => this.scene.start("FarmScene", { visitorMode: false })
    });

    gameEventBus.emit("areaChanged", { area: "Town Area" });
    this.cleanup.push(
      gameEventBus.on("visitorFarmLoaded", (payload) => {
        this.scene.start("FarmScene", {
          visitorMode: true,
          farm: payload as PublicFarmResponse
        });
      })
    );

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.cleanup.forEach((fn) => fn());
      this.cleanup = [];
      this.controller?.destroy();
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

  private drawGround(width: number, height: number) {
    for (let y = 0; y < height; y += TILE_SIZE) {
      for (let x = 0; x < width; x += TILE_SIZE) {
        this.add.image(x + TILE_SIZE / 2, y + TILE_SIZE / 2, ASSET_KEYS.tiles.grass).setDepth(0);
      }
    }
    for (let x = 120; x < width - 100; x += TILE_SIZE) {
      this.add.image(x, 520, ASSET_KEYS.tiles.path).setDepth(1);
    }
    for (let y = 130; y < height - 30; y += TILE_SIZE) {
      this.add.image(700, y, ASSET_KEYS.tiles.path).setDepth(1);
    }
    this.add.text(645, 870, "Home Farm", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#203024",
      backgroundColor: "rgba(255,252,243,0.9)",
      padding: { x: 8, y: 4 }
    }).setDepth(8);
  }

  private addStaticObject(
    x: number,
    y: number,
    texture: string,
    bodyWidth: number,
    bodyHeight: number,
    offsetX: number,
    offsetY: number
  ) {
    const object = this.obstacles.create(x, y, texture) as Phaser.Physics.Arcade.Sprite;
    object.setDepth(5);
    object.body?.setSize(bodyWidth, bodyHeight);
    object.body?.setOffset(offsetX, offsetY);
    object.refreshBody();
    return object;
  }
}
