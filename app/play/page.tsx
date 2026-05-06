"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Droplets, Pickaxe, Plus, RefreshCw } from "lucide-react";
import { AuthGate } from "@/components/layout/AuthGate";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { Stat } from "@/components/ui/stat";
import { GardenGrid, GardenPlotView, PlotSummary } from "@/components/garden/GardenGrid";
import { apiFetch } from "@/lib/utils/fetcher";
import { useGameStore } from "@/store/useGameStore";

type GardenResponse = {
  user: {
    growBalance: number;
    availableGrow: number;
    stamina: number;
    maxStamina: number;
    gardenLevel: number;
    nextStaminaAt?: string | null;
  };
  garden: {
    id: string;
    width: number;
    height: number;
    level: number;
    plots: GardenPlotView[];
  };
  seeds: Array<{
    id: string;
    seedId: string;
    quantity: number;
    seed: { id: string; name: string; iconUrl: string; rarity: string };
  }>;
};

function PlayContent() {
  const queryClient = useQueryClient();
  const { selectedPlotId, setSelectedPlotId, selectedSeedId, setSelectedSeedId } = useGameStore();
  const [error, setError] = useState<string | null>(null);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["garden"],
    queryFn: () => apiFetch<GardenResponse>("/api/garden"),
    refetchInterval: 10_000
  });

  const selectedPlot = useMemo(() => {
    if (!data?.garden.plots.length) {
      return null;
    }
    return data.garden.plots.find((plot) => plot.id === selectedPlotId) || data.garden.plots[0];
  }, [data, selectedPlotId]);

  const selectedSeed = data?.seeds.find((seed) => seed.seedId === selectedSeedId) || data?.seeds[0];

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["garden"] }),
      queryClient.invalidateQueries({ queryKey: ["me"] })
    ]);
  };

  const makeMutation = (url: string, body: Record<string, unknown>) =>
    apiFetch(url, { method: "POST", body: JSON.stringify(body) });

  const plantMutation = useMutation({
    mutationFn: () =>
      makeMutation("/api/garden/plant", {
        plotId: selectedPlot?.id,
        seedId: selectedSeed?.seedId
      }),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof Error ? err.message : "Planting failed")
  });
  const waterMutation = useMutation({
    mutationFn: () => makeMutation("/api/garden/water", { plotId: selectedPlot?.id }),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof Error ? err.message : "Watering failed")
  });
  const harvestMutation = useMutation({
    mutationFn: () => makeMutation("/api/garden/harvest", { plotId: selectedPlot?.id }),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof Error ? err.message : "Harvest failed")
  });
  const expandMutation = useMutation({
    mutationFn: () => apiFetch("/api/garden/expand", { method: "POST" }),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof Error ? err.message : "Expansion failed")
  });

  if (isLoading || !data) {
    return <Card className="font-bold text-leaf-800">Loading garden...</Card>;
  }

  return (
    <>
      <PageHeader
        title="Garden"
        eyebrow="Personal grow grid"
        actions={
          <>
            <Button variant="secondary" onClick={() => refetch()}>
              <RefreshCw size={16} /> Refresh
            </Button>
            <Button onClick={() => expandMutation.mutate()} disabled={expandMutation.isPending}>
              <Plus size={16} /> Expand
            </Button>
          </>
        }
      />

      <div className="mb-4 grid gap-3 sm:grid-cols-4">
        <Stat label="$GROW" value={data.user.availableGrow} />
        <Stat label="Stamina" value={`${data.user.stamina}/${data.user.maxStamina}`} />
        <Stat label="Garden" value={`${data.garden.width}x${data.garden.height}`} />
        <Stat label="Level" value={data.garden.level} />
      </div>

      {error ? (
        <div className="mb-4 rounded-lg bg-berry-100 px-4 py-3 text-sm font-bold text-berry-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <GardenGrid
          width={data.garden.width}
          plots={data.garden.plots}
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
                {data.seeds.length === 0 ? <option value="">No seeds</option> : null}
                {data.seeds.map((stack) => (
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
