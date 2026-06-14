"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Droplets, Pickaxe, Plus, ShieldAlert, Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RarityBadge } from "@/components/game/shared/RarityBadge";
import { CountdownBadge } from "@/components/game/shared/CountdownBadge";
import { EmptyState } from "@/components/game/shared/StatusStates";
import { gameEventBus } from "@/lib/game/eventBus";
import { findOnchainSeed } from "@/lib/solana/growfiData";
import {
  decodeGrowfiError,
  useGrowfiActions,
  useGrowfiOnchainState,
} from "@/lib/solana/useGrowfiProgram";
import type { GardenPlotView, GardenResponse } from "@/types/game-data";

type SeedStack = GardenResponse["seeds"][number];
type OnchainPlotAccount = {
  state?: unknown;
  seedId?: unknown;
  growCompleteAt?: unknown;
  nextHarvestAt?: unknown;
  waterLevel?: unknown;
  health?: unknown;
  harvestCount?: unknown;
  maxHarvests?: unknown;
};

function variantName(value: unknown) {
  if (!value || typeof value !== "object") {
    return String(value);
  }
  return Object.keys(value as Record<string, unknown>)[0] || String(value);
}

function numberFromValue(value: unknown) {
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (value && typeof value === "object" && "toNumber" in value) {
    return (value as { toNumber: () => number }).toNumber();
  }
  return Number(value || 0);
}

function isoFromUnix(value: unknown) {
  const seconds = numberFromValue(value);
  return seconds > 0 ? new Date(seconds * 1000).toISOString() : undefined;
}

function formatDuration(seconds?: number) {
  if (!seconds) {
    return "None";
  }
  if (seconds < 60) {
    return `${seconds}s`;
  }
  if (seconds < 3600) {
    return `${Math.round(seconds / 60)}m`;
  }
  return `${Math.round(seconds / 3600)}h`;
}

function SeedPlantCard({
  stack,
  currentFarmLevel,
  busy,
  locked,
  onPlant,
}: {
  stack: SeedStack;
  currentFarmLevel: number;
  busy: boolean;
  locked: boolean;
  onPlant: () => void;
}) {
  const requiredLevel = stack.seed.requiredGardenLevel || 1;

  return (
    <div className="pixel-card space-y-3 p-3">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-md bg-[#0d2614] text-2xl">
          {stack.seed.iconUrl}
        </span>
        <div className="min-w-0 flex-1">
          <div className="font-bold text-[#f2fbf1]">{stack.seed.name}</div>
          <div className="mt-1 flex flex-wrap items-center gap-1">
            <RarityBadge rarity={stack.seed.rarity} />
            <span className="pixel-badge text-[#f7d767]">x{stack.quantity}</span>
            {locked ? (
              <span className="pixel-badge text-[#ff9ebd] gap-1">
                <Lock className="h-3 w-3" />
                Locked
              </span>
            ) : null}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-xs text-[#91d985]">
        <div className="pixel-card-sunken p-2">
          <div className="pixel-label">Required</div>
          Farm Level {requiredLevel}
        </div>
        <div className="pixel-card-sunken p-2">
          <div className="pixel-label">Current</div>
          Farm Level {currentFarmLevel}
        </div>
        <div className="pixel-card-sunken p-2">
          <div className="pixel-label">Grow</div>
          {formatDuration(stack.seed.growTimeSeconds)}
        </div>
        <div className="pixel-card-sunken p-2">
          <div className="pixel-label">Regrow</div>
          {formatDuration(
            stack.seed.regrowTimeSeconds || stack.seed.harvestCooldownSeconds,
          )}
        </div>
        <div className="pixel-card-sunken p-2">
          <div className="pixel-label">Harvests</div>
          {stack.seed.maxHarvests || 1}
        </div>
        <div className="pixel-card-sunken p-2">
          <div className="pixel-label">Yield</div>
          {stack.seed.minYield || 1}-{stack.seed.maxYield || 1}
        </div>
      </div>
      {locked ? (
        <div className="pixel-card-sunken p-2 text-xs font-semibold text-[#5e8c52]">
          Requires Farm Level {requiredLevel}. Your farm is Level{" "}
          {currentFarmLevel}.
        </div>
      ) : null}
      <button
        type="button"
        className="pixel-btn pixel-btn-primary w-full px-4 py-2"
        disabled={busy || locked}
        onClick={onPlant}
      >
        <Plus className="h-4 w-4" />
        PLANT
      </button>
    </div>
  );
}

export function SeedSelectModal({
  open,
  onOpenChange,
  garden,
  plotId,
  visitorMode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  garden?: GardenResponse;
  plotId?: string | null;
  visitorMode?: boolean;
}) {
  const queryClient = useQueryClient();
  const growfiActions = useGrowfiActions();
  const onchain = useGrowfiOnchainState(open && !visitorMode);
  const [error, setError] = useState<string | null>(null);
  const plot = useMemo<GardenPlotView | undefined>(
    () => garden?.garden.plots.find((item) => item.id === plotId),
    [garden, plotId],
  );
  const onchainPlot = useMemo<OnchainPlotAccount | null>(() => {
    if (!plot) {
      return null;
    }
    const match = onchain.data?.plots.find(
      (item) => item.x === plot.x && item.y === plot.y,
    );
    return (match?.account as OnchainPlotAccount | null) || null;
  }, [onchain.data?.plots, plot]);
  const onchainPlotState = variantName(onchainPlot?.state).toLowerCase();
  const onchainSeedId = numberFromValue(onchainPlot?.seedId);
  const onchainSeed = findOnchainSeed(onchainSeedId);
  const onchainGrowCompleteAt = isoFromUnix(onchainPlot?.growCompleteAt);
  const onchainSeedStacks = (onchain.data?.seedStacks || []) as SeedStack[];
  const seedStacks = onchain.data?.seedInventory
    ? onchainSeedStacks
    : garden?.seeds || [];
  const currentFarmLevel =
    garden?.garden.level || garden?.user.gardenLevel || 1;
  const availableSeedStacks = seedStacks.filter(
    (stack) => (stack.seed.requiredGardenLevel || 1) <= currentFarmLevel,
  );
  const lockedSeedStacks = seedStacks.filter(
    (stack) => (stack.seed.requiredGardenLevel || 1) > currentFarmLevel,
  );
  const plotIsEmpty = onchainPlot
    ? onchainPlotState === "empty"
    : plot?.state === "EMPTY";
  const canWater =
    !visitorMode &&
    !!plot &&
    (onchainPlot
      ? ["growing", "ready", "regrowing"].includes(onchainPlotState)
      : plot.state === "GROWING");
  const onchainHarvestable =
    !!onchainPlot &&
    ["growing", "ready", "regrowing"].includes(onchainPlotState) &&
    (onchainPlotState === "ready" ||
      numberFromValue(
        onchainPlotState === "regrowing"
          ? onchainPlot.nextHarvestAt
          : onchainPlot.growCompleteAt,
      ) <= Math.floor(Date.now() / 1000));
  const canHarvest =
    !visitorMode &&
    !!plot &&
    (onchainPlot ? onchainHarvestable : plot.state === "READY");

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["growfi-onchain-state"] }),
      queryClient.invalidateQueries({ queryKey: ["garden"] }),
      queryClient.invalidateQueries({ queryKey: ["inventory"] }),
      queryClient.invalidateQueries({ queryKey: ["me"] }),
      queryClient.invalidateQueries({ queryKey: ["quests"] }),
      queryClient.invalidateQueries({ queryKey: ["tutorial"] }),
    ]);
  };

  const plantMutation = useMutation({
    mutationFn: (seed: GardenResponse["seeds"][number]["seed"]) => {
      if (!plot) {
        throw new Error("No plot selected.");
      }
      const requiredLevel = seed.requiredGardenLevel || 1;
      if (currentFarmLevel < requiredLevel) {
        throw new Error(
          `Requires Farm Level ${requiredLevel}. Your farm is Level ${currentFarmLevel}.`,
        );
      }
      return growfiActions.plantSeed({ x: plot.x, y: plot.y, seed });
    },
    onSuccess: async () => {
      setError(null);
      onOpenChange(false);
      await invalidate();
      gameEventBus.emit("refreshFarmState");
    },
    onError: (err) => setError(decodeGrowfiError(err)),
  });

  const waterMutation = useMutation({
    mutationFn: () => {
      if (!plot) {
        throw new Error("No plot selected.");
      }
      return growfiActions.waterPlant({ x: plot.x, y: plot.y });
    },
    onSuccess: async () => {
      setError(null);
      onOpenChange(false);
      await invalidate();
      gameEventBus.emit("refreshFarmState");
    },
    onError: (err) => setError(decodeGrowfiError(err)),
  });

  const harvestMutation = useMutation({
    mutationFn: () => {
      if (!plot) {
        throw new Error("No plot selected.");
      }
      return growfiActions.harvestPlant({
        x: plot.x,
        y: plot.y,
        seed: plot.plant?.seed,
      });
    },
    onSuccess: async () => {
      setError(null);
      onOpenChange(false);
      await invalidate();
      gameEventBus.emit("refreshFarmState");
    },
    onError: (err) => setError(decodeGrowfiError(err)),
  });

  const busy =
    plantMutation.isPending ||
    waterMutation.isPending ||
    harvestMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="scanlines flex max-h-[85vh] max-w-2xl flex-col overflow-hidden border-2 border-[#3d9f4b] bg-[#0d2614] text-[#ddf5d9] sm:max-h-[75vh] [&>button]:text-[#91d985] [&>button:hover]:text-[#f7d767]">
        <DialogHeader>
          <DialogTitle className="pixel-heading text-sm text-[#f2fbf1]">
            {plot ? `Plot ${plot.x + 1}, ${plot.y + 1}` : "Farm Plot"}
          </DialogTitle>
          <DialogDescription className="font-sans text-[#91d985]">
            Backend validation handles planting, watering, harvest timing,
            stamina, and inventory.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1 pr-3">
          <div className="space-y-4 pb-1">
            {visitorMode ? (
              <div className="pixel-card flex items-start gap-3 p-4">
                <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#8ad4ff]" />
                <div>
                  <div className="pixel-heading text-xs text-[#8ad4ff]">
                    Read-only visit
                  </div>
                  <p className="mt-1 font-sans text-sm text-[#91d985]">
                    You can inspect this farm, but visitors cannot modify crops
                    in MVP.
                  </p>
                </div>
              </div>
            ) : null}

            {error ? (
              <div className="pixel-card flex items-start gap-3 border-[#a31948] p-4">
                <div>
                  <div className="pixel-heading text-xs text-[#ff9ebd]">
                    Action failed
                  </div>
                  <p className="mt-1 font-sans text-sm text-[#ffe5ee]">
                    {error}
                  </p>
                </div>
              </div>
            ) : null}

            {!plot ? <EmptyState title="No plot selected" /> : null}

            {plot && plotIsEmpty && !visitorMode ? (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-[#f2fbf1]">Choose a seed</h3>
                  <span className="pixel-badge text-[#91d985]">{seedStacks.length} stacks</span>
                </div>
                {seedStacks.length ? (
                  <div className="space-y-4">
                    <div>
                      <div className="mb-2 flex items-center justify-between">
                        <h4 className="text-sm font-black text-[#f2fbf1]">
                          Available to Plant
                        </h4>
                        <span className="pixel-badge text-[#f7d767]">
                          Farm Level {currentFarmLevel}
                        </span>
                      </div>
                      {availableSeedStacks.length ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                          {availableSeedStacks.map((stack) => (
                            <SeedPlantCard
                              key={stack.id}
                              stack={stack}
                              currentFarmLevel={currentFarmLevel}
                              busy={busy}
                              locked={false}
                              onPlant={() => plantMutation.mutate(stack.seed)}
                            />
                          ))}
                        </div>
                      ) : (
                        <EmptyState
                          title="No available seeds"
                          description="Buy beginner seeds from the Seed Shop or upgrade your farm to unlock higher level seeds."
                        />
                      )}
                    </div>

                    {lockedSeedStacks.length ? (
                      <div>
                        <h4 className="mb-2 text-sm font-black text-[#f2fbf1]">
                          Locked by Farm Level
                        </h4>
                        <div className="grid gap-3 sm:grid-cols-2">
                          {lockedSeedStacks.map((stack) => (
                            <SeedPlantCard
                              key={stack.id}
                              stack={stack}
                              currentFarmLevel={currentFarmLevel}
                              busy={busy}
                              locked
                              onPlant={() => undefined}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <EmptyState
                    title="No seeds yet"
                    description="Visit the seed shop in town to buy your first seeds."
                  />
                )}
              </div>
            ) : null}

            {plot && !plot.plant && onchainPlot && !plotIsEmpty ? (
              <div className="pixel-card space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-bold text-[#f2fbf1]">
                      {onchainSeed?.name || `Seed ${onchainSeedId}`}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      <span className="pixel-badge text-[#91d985]">{onchainPlotState}</span>
                      {onchainSeed ? (
                        <RarityBadge rarity={onchainSeed.rarity} />
                      ) : null}
                    </div>
                  </div>
                  <CountdownBadge to={onchainGrowCompleteAt} />
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm text-[#91d985]">
                  <div className="pixel-card-sunken p-2">
                    <div className="pixel-label">Water</div>
                    {numberFromValue(onchainPlot.waterLevel)}/5
                  </div>
                  <div className="pixel-card-sunken p-2">
                    <div className="pixel-label">Health</div>
                    {numberFromValue(onchainPlot.health)}
                  </div>
                  <div className="pixel-card-sunken p-2">
                    <div className="pixel-label">Harvests</div>
                    {numberFromValue(onchainPlot.harvestCount)}/
                    {numberFromValue(onchainPlot.maxHarvests)}
                  </div>
                </div>
                {canWater ? (
                  <button
                    type="button"
                    className="pixel-btn pixel-btn-primary w-full px-4 py-2"
                    disabled={busy}
                    onClick={() => waterMutation.mutate()}
                  >
                    <Droplets className="h-4 w-4" />
                    WATER PLANT
                  </button>
                ) : null}
                {canHarvest ? (
                  <button
                    type="button"
                    className="pixel-btn pixel-btn-gold w-full px-4 py-2"
                    disabled={busy}
                    onClick={() => harvestMutation.mutate()}
                  >
                    <Pickaxe className="h-4 w-4" />
                    HARVEST FRUIT
                  </button>
                ) : null}
              </div>
            ) : null}

            {plot?.plant ? (
              <div className="pixel-card space-y-4 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid h-14 w-14 place-items-center rounded-md bg-[#0d2614] text-3xl">
                      {plot.plant.seed.iconUrl}
                    </span>
                    <div>
                      <div className="font-bold text-[#f2fbf1]">{plot.plant.seed.name}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        <RarityBadge rarity={plot.plant.seed.rarity} />
                        <span className="pixel-badge text-[#91d985]">
                          {plot.plant.state.toLowerCase()}
                        </span>
                      </div>
                    </div>
                  </div>
                  <CountdownBadge
                    to={
                      plot.plant.state === "REGROWING"
                        ? plot.plant.nextHarvestAt
                        : plot.plant.growCompleteAt
                    }
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm text-[#91d985]">
                  <div className="pixel-card-sunken p-2">
                    <div className="pixel-label">Water</div>
                    {plot.plant.waterLevel}/5
                  </div>
                  <div className="pixel-card-sunken p-2">
                    <div className="pixel-label">Health</div>
                    {plot.plant.health}
                  </div>
                  <div className="pixel-card-sunken p-2">
                    <div className="pixel-label">Harvests</div>
                    {plot.plant.harvestCount}/
                    {plot.plant.maxHarvests ??
                      plot.plant.seed.maxHarvests ??
                      1}
                  </div>
                </div>
                {canWater ? (
                  <button
                    type="button"
                    className="pixel-btn pixel-btn-primary w-full px-4 py-2"
                    disabled={busy}
                    onClick={() => waterMutation.mutate()}
                  >
                    <Droplets className="h-4 w-4" />
                    WATER PLANT
                  </button>
                ) : null}
                {canHarvest ? (
                  <button
                    type="button"
                    className="pixel-btn pixel-btn-gold w-full px-4 py-2"
                    disabled={busy}
                    onClick={() => harvestMutation.mutate()}
                  >
                    <Pickaxe className="h-4 w-4" />
                    HARVEST FRUIT
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
