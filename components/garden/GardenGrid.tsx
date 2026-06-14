"use client";

import { Droplets, Lock, Sparkles } from "lucide-react";
import { Countdown } from "@/components/ui/countdown";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils/cn";

export type GardenPlotView = {
  id: string;
  x: number;
  y: number;
  state: "EMPTY" | "GROWING" | "READY" | "REGROWING" | "LOCKED";
  plant?: null | {
    id: string;
    state: "GROWING" | "READY" | "REGROWING" | "DEAD";
    growCompleteAt: string;
    nextHarvestAt?: string | null;
    waterLevel: number;
    health: number;
    harvestCount: number;
    seed: {
      name: string;
      iconUrl: string;
      rarity: string;
      fruit?: { name: string; iconUrl: string } | null;
    };
  };
};

const plotStyles: Record<GardenPlotView["state"], string> = {
  EMPTY: "bg-soil-300 hover:bg-soil-100",
  GROWING: "bg-leaf-100 hover:bg-leaf-50",
  READY: "bg-gold-100 ring-gold-300 hover:bg-gold-300",
  REGROWING: "bg-skyday-100 hover:bg-skyday-50",
  LOCKED: "bg-stone-200 text-stone-500",
};

export function GardenGrid({
  width,
  plots,
  selectedPlotId,
  onSelect,
}: {
  width: number;
  plots: GardenPlotView[];
  selectedPlotId?: string | null;
  onSelect: (plot: GardenPlotView) => void;
}) {
  return (
    <div
      className="plot-grid grid w-full gap-2 rounded-lg bg-soil-700/20 p-2 shadow-insetPlot"
      style={{ "--garden-width": width } as React.CSSProperties}
    >
      {plots.map((plot) => {
        const selected = selectedPlotId === plot.id;
        const icon =
          plot.state === "LOCKED" ? (
            <Lock size={24} />
          ) : plot.plant ? (
            <span className="text-2xl sm:text-3xl">
              {plot.plant.seed.iconUrl}
            </span>
          ) : (
            <span className="text-lg text-soil-700">+</span>
          );

        return (
          <Button
            variant="ghost"
            key={plot.id}
            onClick={() => onSelect(plot)}
            className={cn(
              "relative flex-col aspect-square min-h-12 rounded-lg border border-white/60 p-1 text-center shadow-sm ring-2 ring-transparent transition h-auto w-auto",
              plotStyles[plot.state],
              selected && "ring-leaf-700",
            )}
          >
            <span className="grid h-full place-items-center">{icon}</span>
            {plot.state === "READY" ? (
              <span className="absolute right-1 top-1 rounded-full bg-white/85 p-1 text-gold-700">
                <Sparkles size={12} />
              </span>
            ) : null}
            {plot.plant?.waterLevel ? (
              <span className="absolute bottom-1 left-1 flex items-center gap-0.5 rounded-full bg-white/85 px-1 text-[10px] font-black text-skyday-700">
                <Droplets size={10} />
                {plot.plant.waterLevel}
              </span>
            ) : null}
          </Button>
        );
      })}
    </div>
  );
}

export function PlotSummary({ plot }: { plot: GardenPlotView | null }) {
  if (!plot) {
    return <p className="text-sm font-medium text-leaf-800">Select a plot.</p>;
  }

  if (!plot.plant) {
    return (
      <div className="space-y-1">
        <div className="text-sm font-black text-leaf-900">
          Plot {plot.x + 1},{plot.y + 1}
        </div>
        <div className="text-sm text-leaf-800">{plot.state.toLowerCase()}</div>
      </div>
    );
  }

  const countdownTarget =
    plot.plant.state === "GROWING"
      ? plot.plant.growCompleteAt
      : plot.plant.nextHarvestAt;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-3xl">{plot.plant.seed.iconUrl}</span>
        <div>
          <div className="font-black text-leaf-950">{plot.plant.seed.name}</div>
          <div className="text-xs font-bold uppercase text-leaf-700">
            {plot.plant.state}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-lg bg-white/70 p-2">
          <div className="text-xs font-black uppercase text-leaf-700">
            Timer
          </div>
          <Countdown to={countdownTarget} />
        </div>
        <div className="rounded-lg bg-white/70 p-2">
          <div className="text-xs font-black uppercase text-leaf-700">
            Water
          </div>
          {plot.plant.waterLevel}/5
        </div>
        <div className="rounded-lg bg-white/70 p-2">
          <div className="text-xs font-black uppercase text-leaf-700">
            Health
          </div>
          {plot.plant.health}
        </div>
        <div className="rounded-lg bg-white/70 p-2">
          <div className="text-xs font-black uppercase text-leaf-700">
            Harvests
          </div>
          {plot.plant.harvestCount}
        </div>
      </div>
    </div>
  );
}
