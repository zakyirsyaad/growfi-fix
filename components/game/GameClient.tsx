"use client";

import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { GameCanvas } from "@/components/game/GameCanvas";
import { GameOverlay } from "@/components/game/GameOverlay";
import { Card, CardContent } from "@/components/ui/card";
import { gameEventBus } from "@/lib/game/eventBus";
import { apiFetch } from "@/lib/utils/fetcher";
import type { GardenResponse } from "@/types/game-data";

type ShopResponse = {
  rotation: { id: string; startsAt: string; endsAt: string; status: string };
};

export function GameClient() {
  const { data: garden, isLoading, refetch: refetchGarden } = useQuery({
    queryKey: ["garden"],
    queryFn: () => apiFetch<GardenResponse>("/api/garden"),
    refetchOnWindowFocus: false
  });
  const { data: shop } = useQuery({
    queryKey: ["shop"],
    queryFn: () => apiFetch<ShopResponse>("/api/shop/current"),
    refetchOnWindowFocus: false
  });

  useEffect(() => {
    document.body.dataset.gameRoute = "true";
    return () => {
      delete document.body.dataset.gameRoute;
    };
  }, []);

  useEffect(() => {
    return gameEventBus.on("refreshFarmState", () => {
      refetchGarden();
    });
  }, [refetchGarden]);

  return (
    <div className="relative h-[100svh] w-full overflow-hidden bg-leaf-500">
      <GameCanvas garden={garden} />
      <GameOverlay garden={garden} shopEndsAt={shop?.rotation.endsAt} />
      {isLoading ? (
        <div className="absolute left-1/2 top-1/2 z-40 w-[min(90vw,360px)] -translate-x-1/2 -translate-y-1/2">
          <Card className="bg-white/92">
            <CardContent className="p-4 text-center text-sm font-semibold">
              Loading your farm state...
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
