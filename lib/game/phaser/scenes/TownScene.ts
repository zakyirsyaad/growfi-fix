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

const TOWN_OBJECTS = {
  fountain: { x: 700, y: 510 },
  leaderboard: { x: 470, y: 300 },
  communityBoard: { x: 610, y: 300 },
  eventBoard: { x: 930, y: 300 },
  eventStage: { x: 1020, y: 190 },
  farmPortal: { x: 700, y: 265 },
  chatBoard: { x: 435, y: 560 },
  socialTradePlaza: { x: 890, y: 560 },
  cosmeticShop: { x: 290, y: 260 },
  homePath: { x: 700, y: 875 }
} as const;

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

    this.drawTownObjects();

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
      id: "town-leaderboard",
      type: "leaderboard",
      x: TOWN_OBJECTS.leaderboard.x,
      y: TOWN_OBJECTS.leaderboard.y,
      radius: INTERACTION_RADIUS,
      label: "Press E to view Leaderboard",
      action: { kind: "overlay", overlay: "leaderboard" }
    });
    this.interactionSystem.add({
      id: "town-community-board",
      type: "communityBoard",
      x: TOWN_OBJECTS.communityBoard.x,
      y: TOWN_OBJECTS.communityBoard.y,
      radius: INTERACTION_RADIUS,
      label: "Press E to open Community Board",
      action: { kind: "overlay", overlay: "communityBoard" }
    });
    this.interactionSystem.add({
      id: "town-event-board",
      type: "eventBoard",
      x: TOWN_OBJECTS.eventBoard.x,
      y: TOWN_OBJECTS.eventBoard.y,
      radius: INTERACTION_RADIUS,
      label: "Press E to view Events",
      action: { kind: "overlay", overlay: "eventBoard" }
    });
    this.interactionSystem.add({
      id: "town-farm-portal",
      type: "visitFarm",
      x: TOWN_OBJECTS.farmPortal.x,
      y: TOWN_OBJECTS.farmPortal.y,
      radius: INTERACTION_RADIUS,
      label: "Press E to visit farms",
      action: { kind: "overlay", overlay: "visitFarm" }
    });
    this.interactionSystem.add({
      id: "town-chat-board",
      type: "chatBoard",
      x: TOWN_OBJECTS.chatBoard.x,
      y: TOWN_OBJECTS.chatBoard.y,
      radius: INTERACTION_RADIUS,
      label: "Press E to open Chat",
      action: { kind: "overlay", overlay: "localChat" }
    });
    this.interactionSystem.add({
      id: "town-social-trade-plaza",
      type: "socialTradePlaza",
      x: TOWN_OBJECTS.socialTradePlaza.x,
      y: TOWN_OBJECTS.socialTradePlaza.y,
      radius: 92,
      label: "Press E to find nearby traders",
      action: { kind: "overlay", overlay: "onlinePlayers" }
    });
    this.interactionSystem.add({
      id: "town-cosmetic-shop",
      type: "cosmeticShop",
      x: TOWN_OBJECTS.cosmeticShop.x,
      y: TOWN_OBJECTS.cosmeticShop.y + 42,
      radius: 80,
      label: "Press E to preview Decoration Shop",
      action: {
        kind: "toast",
        title: "Decoration shop coming soon",
        description: "Cosmetic farm decorations are planned for a later Town update."
      }
    });
    this.interactionSystem.add({
      id: "town-home-path",
      type: "townExit",
      x: TOWN_OBJECTS.homePath.x,
      y: TOWN_OBJECTS.homePath.y,
      radius: 90,
      label: "Press E to return Home",
      action: { kind: "map", map: "farm" }
    });

    this.transitions.add({
      id: "walk-home",
      rect: new Phaser.Geom.Rectangle(620, 910, 160, 82),
      onEnter: () => this.scene.start("FarmScene", { visitorMode: false })
    });

    gameEventBus.emit("areaChanged", { area: "Town Social Hub" });
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
    for (let x = 225; x < width - 210; x += TILE_SIZE) {
      this.add.image(x, 510, ASSET_KEYS.tiles.path).setDepth(1);
      this.add.image(x, 542, ASSET_KEYS.tiles.path).setDepth(1);
    }
    for (let y = 130; y < height - 30; y += TILE_SIZE) {
      this.add.image(684, y, ASSET_KEYS.tiles.path).setDepth(1);
      this.add.image(716, y, ASSET_KEYS.tiles.path).setDepth(1);
    }
    for (let x = 572; x <= 828; x += TILE_SIZE) {
      for (let y = 414; y <= 606; y += TILE_SIZE) {
        this.add.image(x, y, ASSET_KEYS.tiles.path).setDepth(1);
      }
    }
    this.add.text(645, 870, "Home Farm", {
      fontFamily: "monospace",
      fontSize: "12px",
      color: "#203024",
      backgroundColor: "rgba(255,252,243,0.9)",
      padding: { x: 8, y: 4 }
    }).setDepth(8);
  }

  private drawTownObjects() {
    const fountain = this.addStaticObject(
      TOWN_OBJECTS.fountain.x,
      TOWN_OBJECTS.fountain.y,
      ASSET_KEYS.objects.fountain,
      78,
      42,
      9,
      28
    );
    fountain.setDepth(6);

    this.add.sprite(TOWN_OBJECTS.leaderboard.x, TOWN_OBJECTS.leaderboard.y, ASSET_KEYS.objects.leaderboard).setDepth(6);
    this.add.sprite(TOWN_OBJECTS.communityBoard.x, TOWN_OBJECTS.communityBoard.y, ASSET_KEYS.objects.communityBoard).setDepth(6);
    this.add.sprite(TOWN_OBJECTS.eventBoard.x, TOWN_OBJECTS.eventBoard.y, ASSET_KEYS.objects.eventBoard).setDepth(6);
    this.add.sprite(TOWN_OBJECTS.eventStage.x, TOWN_OBJECTS.eventStage.y, ASSET_KEYS.objects.eventStage).setDepth(5);
    this.add.sprite(TOWN_OBJECTS.farmPortal.x, TOWN_OBJECTS.farmPortal.y, ASSET_KEYS.objects.portal).setDepth(7);
    this.add.sprite(TOWN_OBJECTS.chatBoard.x, TOWN_OBJECTS.chatBoard.y, ASSET_KEYS.objects.chatBoard).setDepth(6);
    this.add.sprite(TOWN_OBJECTS.cosmeticShop.x, TOWN_OBJECTS.cosmeticShop.y, ASSET_KEYS.objects.cosmeticShop).setDepth(5);
    this.add.sprite(TOWN_OBJECTS.cosmeticShop.x + 66, TOWN_OBJECTS.cosmeticShop.y + 70, ASSET_KEYS.characters.npc).setDepth(9);

    this.add.circle(TOWN_OBJECTS.socialTradePlaza.x, TOWN_OBJECTS.socialTradePlaza.y, 54, 0xf7d767, 0.2).setDepth(2);
    this.add.circle(TOWN_OBJECTS.socialTradePlaza.x, TOWN_OBJECTS.socialTradePlaza.y, 54).setStrokeStyle(3, 0xd99a1f, 0.8).setDepth(3);

    [
      [575, 630],
      [825, 630],
      [575, 386],
      [825, 386],
      [344, 606],
      [1044, 606]
    ].forEach(([x, y]) => this.add.sprite(x, y, ASSET_KEYS.objects.bench).setDepth(6));

    [
      [530, 410],
      [870, 410],
      [530, 620],
      [870, 620],
      [350, 480],
      [1050, 480]
    ].forEach(([x, y]) => this.add.sprite(x, y, ASSET_KEYS.objects.lamp).setDepth(7));

    [
      [180, 180],
      [1270, 180],
      [180, 830],
      [1280, 820],
      [1170, 330],
      [305, 745]
    ].forEach(([x, y]) => this.add.sprite(x, y, ASSET_KEYS.objects.tree).setDepth(4));

    [
      [540, 250],
      [858, 250],
      [375, 370],
      [1010, 370],
      [500, 708],
      [920, 710],
      [760, 740]
    ].forEach(([x, y]) => this.add.sprite(x, y, ASSET_KEYS.objects.flower).setDepth(5));
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
