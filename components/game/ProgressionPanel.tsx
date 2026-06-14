"use client";

import {
  ArrowUpRight,
  CheckCircle2,
  Grid3X3,
  Lightbulb,
  Sprout,
} from "lucide-react";
import type { GardenResponse } from "@/types/game-data";

export function ProgressionPanel({
  garden,
  compact = false,
}: {
  garden?: GardenResponse;
  compact?: boolean;
}) {
  const progression = garden?.progression;
  if (!progression) {
    return null;
  }

  const questValue =
    progression.dailyQuestProgress.target > 0
      ? (progression.dailyQuestProgress.progress /
          progression.dailyQuestProgress.target) *
        100
      : 0;

  return (
    <div className={`pixel-hud ${compact ? "space-y-3 p-3" : "space-y-4 p-4"}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="pixel-label">Progression</div>
          <div className="font-sans font-black text-[#f2fbf1]">
            Garden Level {progression.currentGardenLevel}
          </div>
        </div>
        <span className="pixel-badge gap-1 text-[#8ad4ff]">
          <Grid3X3 className="h-3 w-3" />
          {progression.farmSize}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 text-xs font-semibold text-[#ddf5d9]">
        <div className="pixel-card-sunken p-2">
          <div className="pixel-label">Plots</div>
          {progression.totalPlots}
        </div>
        <div className="pixel-card-sunken p-2">
          <div className="pixel-label">Active</div>
          {progression.activePlants}
        </div>
        <div className="pixel-card-sunken p-2">
          <div className="pixel-label">Ready</div>
          {progression.readyToHarvestCount}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2 text-xs font-bold text-[#91d985]">
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Daily quests
          </span>
          <span>
            {progression.dailyQuestProgress.completed}/
            {progression.dailyQuestProgress.total}
          </span>
        </div>
        <div className="pixel-progress">
          <span style={{ width: `${questValue}%` }} />
        </div>
      </div>

      <div className="pixel-card-sunken p-2 text-sm font-semibold text-[#ddf5d9]">
        <span className="inline-flex items-start gap-2">
          <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-[#f7d767]" />
          {progression.suggestedNextAction}
        </span>
      </div>

      {!compact ? (
        <div className="grid gap-2 text-sm">
          <div className="pixel-card-sunken p-2">
            <div className="pixel-label flex items-center gap-1">
              <Sprout className="h-3.5 w-3.5" />
              Unlocked now
            </div>
            <div className="mt-1 font-semibold text-[#ddf5d9]">
              {progression.seedsUnlockedCurrentLevel.join(", ") ||
                "No seeds yet"}
            </div>
          </div>
          <div className="pixel-card-sunken p-2">
            <div className="pixel-label flex items-center gap-1">
              <ArrowUpRight className="h-3.5 w-3.5" />
              Next level
            </div>
            <div className="mt-1 font-semibold text-[#ddf5d9]">
              {progression.nextFarmUpgradeCost === null
                ? "Max level reached"
                : `${progression.nextFarmUpgradeCost} $GROW`}
            </div>
            {progression.seedsUnlockedNextLevel.length > 0 ? (
              <div className="mt-1 text-xs text-[#91d985]">
                Unlocks {progression.seedsUnlockedNextLevel.join(", ")}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
