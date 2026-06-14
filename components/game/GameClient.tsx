"use client";

import { useEffect, useMemo, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { GameCanvas } from "@/components/game/GameCanvas";
import { GameOverlay } from "@/components/game/GameOverlay";
import { Card, CardContent } from "@/components/ui/card";
import { gameEventBus } from "@/lib/game/eventBus";
import {
  mergeOnchainGarden,
  useGrowfiOnchainState,
  useGrowfiShop,
} from "@/lib/solana/useGrowfiProgram";
import { apiFetch } from "@/lib/utils/fetcher";
import type { GardenResponse } from "@/types/game-data";

export function GameClient() {
  const questProgressRef = useRef<Map<
    string,
    { progress: number; completed: boolean }
  > | null>(null);
  const readyPlantRef = useRef<Map<string, boolean> | null>(null);
  const tutorialRewardedRef = useRef<boolean | null>(null);
  const onchain = useGrowfiOnchainState();
  const refetchOnchain = onchain.refetch;
  const {
    data: garden,
    isLoading,
    refetch: refetchGarden,
  } = useQuery({
    queryKey: ["garden"],
    queryFn: () => apiFetch<GardenResponse>("/api/garden"),
    refetchInterval: 15_000,
    refetchOnWindowFocus: false,
  });
  const { data: shop } = useGrowfiShop();
  const displayGarden = useMemo(
    () => mergeOnchainGarden(garden, onchain.data),
    [garden, onchain.data],
  );

  useEffect(() => {
    if (displayGarden) {
      gameEventBus.emit("gardenStateUpdated", displayGarden);
    }
  }, [displayGarden]);

  useEffect(() => {
    document.body.dataset.gameRoute = "true";
    return () => {
      delete document.body.dataset.gameRoute;
    };
  }, []);

  useEffect(() => {
    return gameEventBus.on("refreshFarmState", () => {
      refetchGarden();
      refetchOnchain();
    });
  }, [refetchGarden, refetchOnchain]);

  useEffect(() => {
    if (!displayGarden?.dailyQuests) {
      return;
    }

    const previous = questProgressRef.current;
    const next = new Map<string, { progress: number; completed: boolean }>();
    displayGarden.dailyQuests.forEach((quest) => {
      const progress = Math.min(quest.progress, quest.target);
      const completed = progress >= quest.target;
      const old = previous?.get(quest.questKey);
      if (old && progress > old.progress) {
        if (completed && !old.completed) {
          toast.success("Quest completed", { description: quest.title });
        } else {
          toast("Quest progress", {
            description: `${quest.title}: ${progress}/${quest.target}`,
          });
        }
      }
      next.set(quest.questKey, { progress, completed });
    });
    questProgressRef.current = next;
  }, [displayGarden?.dailyQuests]);

  useEffect(() => {
    if (!displayGarden?.garden.plots) {
      return;
    }

    const previous = readyPlantRef.current;
    const next = new Map<string, boolean>();
    displayGarden.garden.plots.forEach((plot) => {
      const key = plot.plant?.id || plot.id;
      const ready = plot.state === "READY" || plot.plant?.state === "READY";
      const wasReady = previous?.get(key);
      if (previous && ready && !wasReady && plot.plant) {
        toast.success("Plant ready to harvest", {
          description: `${plot.plant.seed.name} is ready.`,
        });
      }
      next.set(key, ready);
    });
    readyPlantRef.current = next;
  }, [displayGarden?.garden.plots]);

  useEffect(() => {
    if (!displayGarden?.tutorial) {
      return;
    }

    if (
      tutorialRewardedRef.current === false &&
      displayGarden.tutorial.rewarded
    ) {
      toast.success("Tutorial complete", {
        description: "Starter reward added to your farm.",
      });
    }
    tutorialRewardedRef.current = displayGarden.tutorial.rewarded;
  }, [displayGarden?.tutorial]);

  return (
    <div className="relative h-[100svh] w-full overflow-hidden bg-leaf-500">
      <GameCanvas />
      <GameOverlay garden={displayGarden} shopEndsAt={shop?.rotation?.endsAt} />
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
