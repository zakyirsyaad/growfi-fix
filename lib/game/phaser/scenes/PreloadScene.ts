import * as Phaser from "phaser";
import { ASSET_KEYS } from "@/lib/game/phaser/config/assets";

function texture(scene: Phaser.Scene, key: string, draw: (graphics: Phaser.GameObjects.Graphics) => void) {
  if (scene.textures.exists(key)) {
    return;
  }
  const graphics = scene.add.graphics();
  draw(graphics);
  graphics.generateTexture(key, 32, 32);
  graphics.destroy();
}

function objectTexture(scene: Phaser.Scene, key: string, width: number, height: number, draw: (graphics: Phaser.GameObjects.Graphics) => void) {
  if (scene.textures.exists(key)) {
    return;
  }
  const graphics = scene.add.graphics();
  draw(graphics);
  graphics.generateTexture(key, width, height);
  graphics.destroy();
}

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super("PreloadScene");
  }

  create() {
    texture(this, ASSET_KEYS.tiles.grass, (g) => {
      g.fillStyle(0x8fcf6a, 1).fillRect(0, 0, 32, 32);
      g.fillStyle(0x79b85b, 1).fillRect(2, 5, 4, 2).fillRect(19, 21, 5, 2);
    });
    texture(this, ASSET_KEYS.tiles.path, (g) => {
      g.fillStyle(0xd7b982, 1).fillRect(0, 0, 32, 32);
      g.fillStyle(0xbd935e, 1).fillRect(0, 29, 32, 3).fillRect(4, 7, 7, 2);
    });
    texture(this, ASSET_KEYS.tiles.water, (g) => {
      g.fillStyle(0x5db7d9, 1).fillRect(0, 0, 32, 32);
      g.fillStyle(0x9be4ef, 0.7).fillRect(4, 8, 18, 2).fillRect(12, 20, 16, 2);
    });
    texture(this, ASSET_KEYS.tiles.fence, (g) => {
      g.fillStyle(0x7a4f2b, 1).fillRect(6, 0, 5, 32).fillRect(21, 0, 5, 32);
      g.fillStyle(0xa96e3f, 1).fillRect(0, 10, 32, 5).fillRect(0, 22, 32, 5);
    });
    texture(this, ASSET_KEYS.tiles.soilEmpty, (g) => {
      g.fillStyle(0x9b6c37, 1).fillRoundedRect(2, 2, 28, 28, 4);
      g.fillStyle(0x6b4426, 0.55).fillRect(6, 11, 20, 3).fillRect(8, 20, 16, 2);
    });
    texture(this, ASSET_KEYS.tiles.soilLocked, (g) => {
      g.fillStyle(0x868276, 1).fillRoundedRect(2, 2, 28, 28, 4);
      g.fillStyle(0x4e4a40, 1).fillRect(10, 14, 12, 9).fillRect(13, 9, 6, 6);
    });
    texture(this, ASSET_KEYS.tiles.sprout, (g) => {
      g.fillStyle(0x9b6c37, 1).fillRoundedRect(2, 2, 28, 28, 4);
      g.fillStyle(0x3d9f4b, 1).fillRect(15, 13, 2, 10).fillEllipse(12, 14, 8, 5).fillEllipse(20, 13, 8, 5);
    });
    texture(this, ASSET_KEYS.tiles.plantSmall, (g) => {
      g.fillStyle(0x9b6c37, 1).fillRoundedRect(2, 2, 28, 28, 4);
      g.fillStyle(0x287235, 1).fillRect(15, 9, 3, 15).fillEllipse(11, 13, 10, 7).fillEllipse(22, 12, 10, 7).fillEllipse(17, 8, 8, 7);
    });
    texture(this, ASSET_KEYS.tiles.plantMedium, (g) => {
      g.fillStyle(0x9b6c37, 1).fillRoundedRect(2, 2, 28, 28, 4);
      g.fillStyle(0x287235, 1).fillRect(14, 6, 4, 18).fillEllipse(9, 12, 13, 8).fillEllipse(23, 11, 13, 8).fillEllipse(16, 7, 11, 9);
      g.fillStyle(0xff9ebd, 1).fillCircle(21, 15, 3);
    });
    texture(this, ASSET_KEYS.tiles.plantReady, (g) => {
      g.fillStyle(0x9b6c37, 1).fillRoundedRect(2, 2, 28, 28, 4);
      g.fillStyle(0x287235, 1).fillRect(14, 5, 4, 19).fillEllipse(8, 12, 13, 8).fillEllipse(23, 11, 13, 8).fillEllipse(16, 7, 11, 9);
      g.fillStyle(0xf7d767, 1).fillCircle(10, 16, 4).fillCircle(22, 17, 4).fillCircle(17, 11, 4);
    });
    texture(this, ASSET_KEYS.tiles.regrowing, (g) => {
      g.fillStyle(0x9b6c37, 1).fillRoundedRect(2, 2, 28, 28, 4);
      g.fillStyle(0x7bcf89, 1).fillRect(14, 10, 4, 14).fillEllipse(11, 14, 9, 6).fillEllipse(21, 14, 9, 6);
    });

    objectTexture(this, ASSET_KEYS.characters.player, 32, 40, (g) => {
      g.fillStyle(0xffd6a6, 1).fillRoundedRect(10, 6, 12, 11, 4);
      g.fillStyle(0x7a4f2b, 1).fillRect(8, 4, 16, 5).fillRect(11, 2, 10, 3);
      g.fillStyle(0x3d9f4b, 1).fillRoundedRect(8, 17, 16, 14, 3);
      g.fillStyle(0x203024, 1).fillRect(11, 31, 4, 7).fillRect(18, 31, 4, 7);
      g.fillStyle(0xffffff, 1).fillRect(13, 10, 2, 2).fillRect(19, 10, 2, 2);
    });
    objectTexture(this, ASSET_KEYS.characters.npc, 32, 40, (g) => {
      g.fillStyle(0xffd6a6, 1).fillRoundedRect(10, 7, 12, 11, 4);
      g.fillStyle(0x9b3d53, 1).fillRect(8, 4, 16, 5);
      g.fillStyle(0xf7d767, 1).fillRoundedRect(8, 18, 16, 14, 3);
      g.fillStyle(0x203024, 1).fillRect(11, 32, 4, 6).fillRect(18, 32, 4, 6);
    });
    objectTexture(this, ASSET_KEYS.objects.house, 132, 96, (g) => {
      g.fillStyle(0x8b5d0b, 1).fillTriangle(6, 35, 66, 0, 126, 35);
      g.fillStyle(0xfff4c7, 1).fillRoundedRect(18, 35, 96, 56, 4);
      g.fillStyle(0x5e3b20, 1).fillRect(58, 58, 18, 33).fillRect(28, 46, 18, 15).fillRect(86, 46, 18, 15);
    });
    objectTexture(this, ASSET_KEYS.objects.mailbox, 32, 36, (g) => {
      g.fillStyle(0x5e3b20, 1).fillRect(14, 18, 4, 18);
      g.fillStyle(0x2b9ee7, 1).fillRoundedRect(5, 7, 22, 15, 5);
      g.fillStyle(0xffffff, 1).fillRect(9, 11, 10, 2);
    });
    objectTexture(this, ASSET_KEYS.objects.farmBoard, 64, 52, (g) => {
      g.fillStyle(0x5e3b20, 1).fillRect(8, 8, 48, 28).fillRect(17, 36, 5, 16).fillRect(42, 36, 5, 16);
      g.fillStyle(0xfff4c7, 1).fillRect(14, 14, 36, 16);
      g.fillStyle(0x287235, 1).fillRect(18, 18, 28, 3).fillRect(18, 24, 18, 3);
    });
    objectTexture(this, ASSET_KEYS.objects.storageChest, 46, 34, (g) => {
      g.fillStyle(0x8b5d0b, 1).fillRoundedRect(4, 9, 38, 21, 4);
      g.fillStyle(0xd99a1f, 1).fillRect(4, 16, 38, 4).fillRect(20, 9, 6, 21);
      g.fillStyle(0x5e3b20, 1).fillRect(19, 18, 8, 7);
    });
    objectTexture(this, ASSET_KEYS.objects.waterWell, 56, 58, (g) => {
      g.fillStyle(0x868276, 1).fillEllipse(28, 38, 40, 20).fillRect(8, 26, 40, 15);
      g.fillStyle(0x5db7d9, 1).fillEllipse(28, 31, 28, 10);
      g.fillStyle(0x7a4f2b, 1).fillRect(9, 8, 5, 24).fillRect(42, 8, 5, 24);
      g.fillStyle(0xa96e3f, 1).fillTriangle(4, 12, 28, 0, 52, 12);
    });
    objectTexture(this, ASSET_KEYS.objects.scarecrow, 40, 56, (g) => {
      g.fillStyle(0xd99a1f, 1).fillCircle(20, 12, 8);
      g.fillStyle(0x5e3b20, 1).fillRect(8, 18, 24, 5).fillRect(18, 20, 4, 30);
      g.fillStyle(0x3d9f4b, 1).fillRoundedRect(12, 24, 16, 16, 3);
    });
    objectTexture(this, ASSET_KEYS.objects.petArea, 54, 42, (g) => {
      g.fillStyle(0xd8b982, 1).fillRoundedRect(7, 18, 40, 18, 5);
      g.fillStyle(0x7a4f2b, 1).fillRect(10, 8, 34, 12).fillTriangle(7, 8, 27, 0, 47, 8);
      g.fillStyle(0x203024, 1).fillCircle(20, 28, 3).fillCircle(34, 28, 3);
    });
    objectTexture(this, ASSET_KEYS.objects.questBoard, 68, 58, (g) => {
      g.fillStyle(0x5e3b20, 1).fillRect(8, 8, 52, 34).fillRect(18, 42, 5, 16).fillRect(45, 42, 5, 16);
      g.fillStyle(0xfff4c7, 1).fillRect(15, 14, 38, 22);
      g.fillStyle(0xe74376, 1).fillCircle(49, 17, 3);
      g.fillStyle(0x203024, 1).fillRect(20, 20, 22, 3).fillRect(20, 28, 26, 3);
    });
    objectTexture(this, ASSET_KEYS.objects.bush, 36, 28, (g) => {
      g.fillStyle(0x287235, 1).fillCircle(11, 17, 9).fillCircle(20, 12, 11).fillCircle(27, 18, 8);
    });
    objectTexture(this, ASSET_KEYS.objects.tree, 54, 76, (g) => {
      g.fillStyle(0x5e3b20, 1).fillRect(24, 42, 8, 30);
      g.fillStyle(0x287235, 1).fillCircle(20, 32, 18).fillCircle(34, 30, 16).fillCircle(27, 18, 18);
    });
    objectTexture(this, ASSET_KEYS.objects.flower, 24, 24, (g) => {
      g.fillStyle(0x3d9f4b, 1).fillRect(11, 10, 2, 12);
      g.fillStyle(0xff9ebd, 1).fillCircle(8, 8, 4).fillCircle(15, 8, 4).fillCircle(12, 12, 4);
      g.fillStyle(0xf7d767, 1).fillCircle(12, 9, 2);
    });
    objectTexture(this, ASSET_KEYS.objects.rock, 28, 22, (g) => {
      g.fillStyle(0x868276, 1).fillRoundedRect(3, 7, 22, 12, 5);
      g.fillStyle(0xaaa69c, 1).fillRect(8, 9, 8, 2);
    });
    objectTexture(this, ASSET_KEYS.objects.shop, 148, 112, (g) => {
      g.fillStyle(0x287235, 1).fillRect(10, 0, 128, 24);
      g.fillStyle(0xf7ead5, 1).fillRoundedRect(18, 24, 112, 80, 4);
      g.fillStyle(0xd99a1f, 1).fillRect(18, 24, 112, 10);
      g.fillStyle(0x5e3b20, 1).fillRect(64, 62, 22, 42).fillRect(32, 44, 25, 20).fillRect(94, 44, 25, 20);
    });
    objectTexture(this, ASSET_KEYS.objects.marketBoard, 74, 64, (g) => {
      g.fillStyle(0x5e3b20, 1).fillRect(10, 14, 54, 36).fillRect(18, 50, 5, 14).fillRect(51, 50, 5, 14);
      g.fillStyle(0xfff4c7, 1).fillRect(16, 20, 42, 23);
    });
    objectTexture(this, ASSET_KEYS.objects.tradeBoard, 74, 64, (g) => {
      g.fillStyle(0x5e3b20, 1).fillRect(10, 14, 54, 36).fillRect(18, 50, 5, 14).fillRect(51, 50, 5, 14);
      g.fillStyle(0x91d985, 1).fillCircle(27, 31, 8).fillCircle(47, 31, 8);
    });
    objectTexture(this, ASSET_KEYS.objects.bank, 72, 76, (g) => {
      g.fillStyle(0x203024, 1).fillTriangle(5, 25, 36, 2, 67, 25);
      g.fillStyle(0xf7ead5, 1).fillRect(12, 25, 48, 42);
      g.fillStyle(0xd99a1f, 1).fillCircle(36, 39, 10);
    });
    objectTexture(this, ASSET_KEYS.objects.portal, 56, 72, (g) => {
      g.lineStyle(6, 0x2b9ee7, 1).strokeEllipse(28, 36, 36, 58);
      g.lineStyle(3, 0xf7d767, 1).strokeEllipse(28, 36, 22, 42);
    });
    objectTexture(this, ASSET_KEYS.objects.leaderboard, 82, 72, (g) => {
      g.fillStyle(0x5e3b20, 1).fillRect(11, 11, 60, 44).fillRect(20, 55, 6, 17).fillRect(56, 55, 6, 17);
      g.fillStyle(0xf7d767, 1).fillRect(21, 19, 40, 8).fillRect(21, 32, 28, 6).fillRect(21, 43, 34, 6);
    });

    this.scene.start("FarmScene", { visitorMode: false });
  }
}
