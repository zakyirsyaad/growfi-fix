"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Droplets, Pickaxe, Plus, RefreshCw } from "lucide-react";
import { AuthGate } from "@/components/layout/AuthGate";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import {
  GardenGrid,
  PlotSummary,
} from "@/components/garden/GardenGrid";
import { apiFetch } from "@/lib/utils/fetcher";
import {
  decodeGrowfiError,
  mergeOnchainGarden,
  useGrowfiActions,
  useGrowfiOnchainState,
} from "@/lib/solana/useGrowfiProgram";
import { useGameStore } from "@/store/useGameStore";
import type { GardenResponse } from "@/types/game-data";

function PlayContent() {
  const queryClient = useQueryClient();
  const growfiActions = useGrowfiActions();
  const onchain = useGrowfiOnchainState();
  const {
    selectedPlotId,
    setSelectedPlotId,
    selectedSeedId,
    setSelectedSeedId,
  } = useGameStore();
  const [error, setError] = useState<string | null>(null);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["garden"],
    queryFn: () => apiFetch<GardenResponse>("/api/garden"),
    refetchInterval: 10_000,
  });
  const displayData = useMemo(
    () => mergeOnchainGarden(data, onchain.data),
    [data, onchain.data]
  );

  const selectedPlot = useMemo(() => {
    if (!displayData?.garden.plots.length) {
      return null;
    }
    return (
      displayData.garden.plots.find((plot) => plot.id === selectedPlotId) ||
      displayData.garden.plots[0]
    );
  }, [displayData, selectedPlotId]);

  const selectedSeed =
    displayData?.seeds.find((seed) => seed.seedId === selectedSeedId) ||
    displayData?.seeds[0];

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["growfi-onchain-state"] }),
      queryClient.invalidateQueries({ queryKey: ["garden"] }),
      queryClient.invalidateQueries({ queryKey: ["me"] }),
    ]);
  };

  const plantMutation = useMutation({
    mutationFn: () => {
      if (!selectedPlot || !selectedSeed) {
        throw new Error("Select a plot and seed first.");
      }
      return growfiActions.plantSeed({
        x: selectedPlot.x,
        y: selectedPlot.y,
        seed: selectedSeed.seed.name,
      });
    },
    onSuccess: invalidate,
    onError: (err) => setError(decodeGrowfiError(err)),
  });
  const waterMutation = useMutation({
    mutationFn: () => {
      if (!selectedPlot) {
        throw new Error("Select a plot first.");
      }
      return growfiActions.waterPlant({ x: selectedPlot.x, y: selectedPlot.y });
    },
    onSuccess: invalidate,
    onError: (err) => setError(decodeGrowfiError(err)),
  });
  const harvestMutation = useMutation({
    mutationFn: () => {
      if (!selectedPlot) {
        throw new Error("Select a plot first.");
      }
      return growfiActions.harvestPlant({
        x: selectedPlot.x,
        y: selectedPlot.y,
        seed: selectedPlot.plant?.seed.name,
      });
    },
    onSuccess: invalidate,
    onError: (err) => setError(decodeGrowfiError(err)),
  });
  const expandMutation = useMutation({
    mutationFn: () => growfiActions.upgradeFarm(),
    onSuccess: invalidate,
    onError: (err) => setError(decodeGrowfiError(err)),
  });

  if (isLoading || !displayData) {
    return <Card className="font-bold text-leaf-800">Loading garden...</Card>;
  }

  return (
    <>
      <PageHeader
        title="Garden"
        eyebrow="Personal grow grid"
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                refetch();
                queryClient.invalidateQueries({
                  queryKey: ["growfi-onchain-state"],
                });
              }}
            >
              <RefreshCw size={16} /> Refresh
            </Button>
            <Button
              onClick={() => expandMutation.mutate()}
              disabled={expandMutation.isPending}
            >
              <Plus size={16} /> Expand
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Stat label="$GROW" value={displayData.user.availableGrow} />
        <Stat
          label="Stamina"
          value={`${displayData.user.stamina}/${displayData.user.maxStamina}`}
        />
        <Stat
          label="Garden"
          value={`${displayData.garden.width}x${displayData.garden.height}`}
        />
        <Stat label="Level" value={displayData.garden.level} />
      </div>

      {error ? (
        <div className="mb-4 rounded-lg bg-berry-100 px-4 py-3 text-sm font-bold text-berry-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <GardenGrid
          width={displayData.garden.width}
          plots={displayData.garden.plots}
          selectedPlotId={selectedPlot?.id}
          onSelect={(plot) => {
            setError(null);
            setSelectedPlotId(plot.id);
          }}
        />

        <Card className="space-y-4">
          <CardTitle>Plot</CardTitle>
          <PlotSummary plot={selectedPlot} />

          {selectedPlot?.state === "EMPTY" ? (
            <div className="space-y-3">
              <select
                className="h-10 w-full rounded-lg border border-leaf-200 bg-white px-3 text-sm font-bold"
                value={selectedSeed?.seedId || ""}
                onChange={(event) => setSelectedSeedId(event.target.value)}
              >
                {displayData.seeds.length === 0 ? (
                  <option value="">No seeds</option>
                ) : null}
                {displayData.seeds.map((stack) => (
                  <option key={stack.id} value={stack.seedId}>
                    {stack.seed.iconUrl} {stack.seed.name} x{stack.quantity}
                  </option>
                ))}
              </select>
              <Button
                className="w-full"
                disabled={!selectedSeed || plantMutation.isPending}
                onClick={() => plantMutation.mutate()}
              >
                <Plus size={16} /> Plant seed
              </Button>
            </div>
          ) : null}

          {selectedPlot?.state === "GROWING" ? (
            <Button
              className="w-full"
              disabled={waterMutation.isPending}
              onClick={() => waterMutation.mutate()}
            >
              <Droplets size={16} /> Water
            </Button>
          ) : null}

          {selectedPlot?.state === "READY" ? (
            <Button
              className="w-full"
              disabled={harvestMutation.isPending}
              onClick={() => harvestMutation.mutate()}
            >
              <Pickaxe size={16} /> Harvest
            </Button>
          ) : null}
        </Card>
      </div>
    </>
  );
}

export default function PlayPage() {
  return (
    <AuthGate>
      <PlayContent />
    </AuthGate>
  );
}
