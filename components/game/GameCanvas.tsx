"use client";

import { memo, useEffect, useRef } from "react";

export const GameCanvas = memo(function GameCanvas() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<{
    destroy: (removeCanvas: boolean, noReturn?: boolean) => void;
  } | null>(null);

  useEffect(() => {
    let mounted = true;

    async function boot() {
      if (!containerRef.current || gameRef.current) {
        return;
      }
      const { createGrowFiGame } = await import("@/lib/game/phaser/GrowFiGame");
      if (!mounted || !containerRef.current) {
        return;
      }
      gameRef.current = createGrowFiGame(containerRef.current);
    }

    boot();

    return () => {
      mounted = false;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="phaser-root absolute inset-0 bg-leaf-500"
    />
  );
});
