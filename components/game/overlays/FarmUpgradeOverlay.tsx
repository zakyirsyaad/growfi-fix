"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Coins, Grid3X3 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ResponsivePanel } from "@/components/game/overlays/ResponsivePanel";
import { apiFetch } from "@/lib/utils/fetcher";
import { gameEventBus } from "@/lib/game/eventBus";
import type { GardenResponse } from "@/types/game-data";

export function FarmUpgradeOverlay({
  open,
  onOpenChange,
  garden
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  garden?: GardenResponse;
}) {
  const queryClient = useQueryClient();
  const upgrades = garden?.upgrades;
  const nextLevel = upgrades?.nextLevel;
  const cost = upgrades?.cost ?? 0;
  const balance = garden?.user.availableGrow ?? 0;
  const canUpgrade = !!nextLevel && balance >= cost;

  const upgradeMutation = useMutation({
    mutationFn: () => apiFetch("/api/garden/expand", { method: "POST" }),
    onSuccess: async () => {
      toast.success("Farm upgraded");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["garden"] }),
        queryClient.invalidateQueries({ queryKey: ["me"] })
      ]);
      gameEventBus.emit("refreshFarmState");
    },
    onError: (err) => {
      toast.error("Upgrade failed", {
        description: err instanceof Error ? err.message : "Try again later."
      });
    }
  });

  return (
    <ResponsivePanel
      open={open}
      onOpenChange={onOpenChange}
      title="Farm Management"
      description="Upgrade your farm size with in-game $GROW. Existing plants stay where they are."
    >
      <div className="space-y-4">
        <Card className="bg-white/82">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-md bg-secondary text-primary">
                  <Grid3X3 className="h-5 w-5" />
                </span>
                <div>
                  <div className="font-black">Level {garden?.garden.level ?? 1} Farm</div>
                  <div className="text-sm text-muted-foreground">
                    {garden?.garden.width ?? 4}x{garden?.garden.height ?? 4} plots
                  </div>
                </div>
              </div>
              <Badge variant="outline">
                {garden?.farmStats?.activePlants ?? 0}/{garden?.farmStats?.totalPlots ?? 16} active
              </Badge>
            </div>
            <Progress
              value={upgrades ? (upgrades.currentLevel / upgrades.maxLevel) * 100 : 20}
            />
          </CardContent>
        </Card>

        {nextLevel ? (
          <Card className="bg-white/82">
            <CardContent className="space-y-4 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase text-leaf-700">Next upgrade</div>
                  <div className="text-xl font-black">
                    Level {nextLevel}: {upgrades?.nextWidth}x{upgrades?.nextHeight}
                  </div>
                </div>
                <Badge variant={canUpgrade ? "common" : "outline"} className="gap-1">
                  <Coins className="h-3.5 w-3.5" />
                  {cost} $GROW
                </Badge>
              </div>
              <Button
                className="w-full"
                disabled={!canUpgrade || upgradeMutation.isPending}
                onClick={() => upgradeMutation.mutate()}
              >
                <ArrowUpRight className="h-4 w-4" />
                Upgrade Farm
              </Button>
              {!canUpgrade ? (
                <p className="text-sm font-semibold text-muted-foreground">
                  Available balance: {balance} $GROW
                </p>
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-white/82">
            <CardContent className="p-4 font-semibold">Your farm is at the current MVP max level.</CardContent>
          </Card>
        )}
      </div>
    </ResponsivePanel>
  );
}
