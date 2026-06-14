"use client";

import {
  ArrowUpRight,
  CheckCircle2,
  Grid3X3,
  Lightbulb,
  Sprout,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
    <Card className="bg-white/88 shadow-sm backdrop-blur">
      <CardContent className={compact ? "space-y-3 p-3" : "space-y-4 p-4"}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="text-xs font-black uppercase text-leaf-700">
              Progression
            </div>
            <div className="font-black">
              Garden Level {progression.currentGardenLevel}
            </div>
          </div>
          <Badge variant="outline" className="gap-1 bg-white/80">
            <Grid3X3 className="h-3.5 w-3.5" />
            {progression.farmSize}
          </Badge>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
          <div className="rounded-md bg-muted p-2">
            <div className="text-muted-foreground">Plots</div>
            {progression.totalPlots}
          </div>
          <div className="rounded-md bg-muted p-2">
            <div className="text-muted-foreground">Active</div>
            {progression.activePlants}
          </div>
          <div className="rounded-md bg-muted p-2">
            <div className="text-muted-foreground">Ready</div>
            {progression.readyToHarvestCount}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs font-bold text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Daily quests
            </span>
            <span>
              {progression.dailyQuestProgress.completed}/
              {progression.dailyQuestProgress.total}
            </span>
          </div>
          <Progress value={questValue} />
        </div>

        <div className="rounded-md bg-leaf-50 p-2 text-sm font-semibold text-leaf-900">
          <span className="inline-flex items-start gap-2">
            <Lightbulb className="mt-0.5 h-4 w-4 shrink-0 text-gold-700" />
            {progression.suggestedNextAction}
          </span>
        </div>

        {!compact ? (
          <div className="grid gap-2 text-sm">
            <div className="rounded-md bg-white/75 p-2">
              <div className="flex items-center gap-1 text-xs font-black uppercase text-muted-foreground">
                <Sprout className="h-3.5 w-3.5" />
                Unlocked now
              </div>
              <div className="mt-1 font-semibold">
                {progression.seedsUnlockedCurrentLevel.join(", ") ||
                  "No seeds yet"}
              </div>
            </div>
            <div className="rounded-md bg-white/75 p-2">
              <div className="flex items-center gap-1 text-xs font-black uppercase text-muted-foreground">
                <ArrowUpRight className="h-3.5 w-3.5" />
                Next level
              </div>
              <div className="mt-1 font-semibold">
                {progression.nextFarmUpgradeCost === null
                  ? "Max level reached"
                  : `${progression.nextFarmUpgradeCost} $GROW`}
              </div>
              {progression.seedsUnlockedNextLevel.length > 0 ? (
                <div className="mt-1 text-xs text-muted-foreground">
                  Unlocks {progression.seedsUnlockedNextLevel.join(", ")}
                </div>
              ) : null}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
