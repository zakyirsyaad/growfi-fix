"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Droplets, Pickaxe, Plus, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RarityBadge } from "@/components/game/shared/RarityBadge";
import { CountdownBadge } from "@/components/game/shared/CountdownBadge";
import { EmptyState } from "@/components/game/shared/StatusStates";
import { apiFetch } from "@/lib/utils/fetcher";
import { gameEventBus } from "@/lib/game/eventBus";
import type { GardenPlotView, GardenResponse } from "@/types/game-data";

export function SeedSelectModal({
  open,
  onOpenChange,
  garden,
  plotId,
  visitorMode
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  garden?: GardenResponse;
  plotId?: string | null;
  visitorMode?: boolean;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const plot = useMemo<GardenPlotView | undefined>(
    () => garden?.garden.plots.find((item) => item.id === plotId),
    [garden, plotId]
  );

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["garden"] }),
      queryClient.invalidateQueries({ queryKey: ["inventory"] }),
      queryClient.invalidateQueries({ queryKey: ["me"] })
    ]);
  };

  const plantMutation = useMutation({
    mutationFn: (seedId: string) =>
      apiFetch("/api/garden/plant", {
        method: "POST",
        body: JSON.stringify({ plotId, seedId })
      }),
    onSuccess: async () => {
      setError(null);
      toast.success("Seed planted");
      onOpenChange(false);
      await invalidate();
      gameEventBus.emit("refreshFarmState");
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Planting failed")
  });

  const waterMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/garden/water", {
        method: "POST",
        body: JSON.stringify({ plotId })
      }),
    onSuccess: async () => {
      setError(null);
      toast.success("Plant watered");
      onOpenChange(false);
      await invalidate();
      gameEventBus.emit("refreshFarmState");
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Watering failed")
  });

  const harvestMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/garden/harvest", {
        method: "POST",
        body: JSON.stringify({ plotId })
      }),
    onSuccess: async () => {
      setError(null);
      toast.success("Fruit harvested");
      onOpenChange(false);
      await invalidate();
      gameEventBus.emit("refreshFarmState");
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Harvest failed")
  });

  const busy = plantMutation.isPending || waterMutation.isPending || harvestMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {plot ? `Plot ${plot.x + 1}, ${plot.y + 1}` : "Farm Plot"}
          </DialogTitle>
          <DialogDescription>
            Backend validation handles planting, watering, harvest timing, stamina, and inventory.
          </DialogDescription>
        </DialogHeader>

        {visitorMode ? (
          <Alert>
            <ShieldAlert className="h-4 w-4" />
            <AlertTitle>Read-only visit</AlertTitle>
            <AlertDescription>You can inspect this farm, but visitors cannot modify crops in MVP.</AlertDescription>
          </Alert>
        ) : null}

        {error ? (
          <Alert variant="destructive">
            <AlertTitle>Action failed</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {!plot ? <EmptyState title="No plot selected" /> : null}

        {plot && plot.state === "EMPTY" && !visitorMode ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="font-bold">Choose a seed</h3>
              <Badge variant="outline">{garden?.seeds.length || 0} stacks</Badge>
            </div>
            {garden?.seeds.length ? (
              <ScrollArea className="max-h-[360px] pr-3">
                <div className="grid gap-3 sm:grid-cols-2">
                  {garden.seeds.map((stack) => (
                    <Card key={stack.id} className="bg-white/80">
                      <CardContent className="space-y-3 p-3">
                        <div className="flex items-center gap-3">
                          <span className="grid h-12 w-12 place-items-center rounded-md bg-secondary text-2xl">
                            {stack.seed.iconUrl}
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="font-bold">{stack.seed.name}</div>
                            <div className="mt-1 flex items-center gap-1">
                              <RarityBadge rarity={stack.seed.rarity} />
                              <Badge variant="outline">x{stack.quantity}</Badge>
                            </div>
                          </div>
                        </div>
                        <Button
                          className="w-full"
                          disabled={busy}
                          onClick={() => plantMutation.mutate(stack.seed.id)}
                        >
                          <Plus className="h-4 w-4" />
                          Plant
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <EmptyState title="No seeds yet" description="Visit the seed shop in town to buy your first seeds." />
            )}
          </div>
        ) : null}

        {plot?.plant ? (
          <Card className="bg-white/80">
            <CardContent className="space-y-4 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="grid h-14 w-14 place-items-center rounded-md bg-secondary text-3xl">
                    {plot.plant.seed.iconUrl}
                  </span>
                  <div>
                    <div className="font-bold">{plot.plant.seed.name}</div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <RarityBadge rarity={plot.plant.seed.rarity} />
                      <Badge variant="outline">{plot.plant.state.toLowerCase()}</Badge>
                    </div>
                  </div>
                </div>
                <CountdownBadge to={plot.plant.state === "REGROWING" ? plot.plant.nextHarvestAt : plot.plant.growCompleteAt} />
              </div>
              <div className="grid grid-cols-3 gap-2 text-sm">
                <div className="rounded-md bg-muted p-2">
                  <div className="text-xs font-semibold text-muted-foreground">Water</div>
                  {plot.plant.waterLevel}/5
                </div>
                <div className="rounded-md bg-muted p-2">
                  <div className="text-xs font-semibold text-muted-foreground">Health</div>
                  {plot.plant.health}
                </div>
                <div className="rounded-md bg-muted p-2">
                  <div className="text-xs font-semibold text-muted-foreground">Harvests</div>
                  {plot.plant.harvestCount}/{plot.plant.maxHarvests ?? plot.plant.seed.maxHarvests ?? 1}
                </div>
              </div>
              {!visitorMode && plot.state === "GROWING" ? (
                <Button className="w-full" disabled={busy} onClick={() => waterMutation.mutate()}>
                  <Droplets className="h-4 w-4" />
                  Water Plant
                </Button>
              ) : null}
              {!visitorMode && plot.state === "READY" ? (
                <Button className="w-full" disabled={busy} onClick={() => harvestMutation.mutate()}>
                  <Pickaxe className="h-4 w-4" />
                  Harvest Fruit
                </Button>
              ) : null}
            </CardContent>
          </Card>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
