import * as Phaser from "phaser";

export function configureCamera(scene: Phaser.Scene, target: Phaser.GameObjects.GameObject) {
  const updateZoom = () => {
    const camera = scene.cameras.main;

    if (!camera) {
      return;
    }

    camera.setZoom(window.innerWidth < 768 ? 1.25 : 1.5);
  };

  scene.cameras.main.startFollow(target, true, 0.12, 0.12);
  updateZoom();
  scene.scale.on("resize", updateZoom);

  return () => {
    scene.scale.off("resize", updateZoom);
  };
}
