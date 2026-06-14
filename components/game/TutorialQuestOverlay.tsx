"use client";

import { CheckCircle2, Gift, HelpCircle } from "lucide-react";
import { gameEventBus } from "@/lib/game/eventBus";
import type { GardenResponse } from "@/types/game-data";

export function TutorialQuestOverlay({
  garden,
  visible,
}: {
  garden?: GardenResponse;
  visible: boolean;
}) {
  const tutorial = garden?.tutorial;
  if (!visible || !tutorial || tutorial.completed || tutorial.skipped) {
    return null;
  }

  const completed = tutorial.steps.filter((step) => step.completed).length;
  const total = tutorial.steps.length || 1;

  return (
    <div className="pointer-events-none absolute bottom-44 left-3 z-30 w-[min(310px,calc(100vw-1.5rem))] md:bottom-4 md:left-4 md:w-[310px]">
      <div className="pixel-hud pointer-events-auto space-y-3 p-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2 text-sm font-black text-[#f2fbf1]">
              <Gift className="h-4 w-4 text-[#f7d767]" />
              Tutorial Quest
            </div>
            <div className="text-xs text-[#91d985]">
              {completed}/{total} steps complete
            </div>
          </div>
          <button
            type="button"
            className="pixel-btn pixel-btn-ghost h-7 w-7 p-0"
            onClick={() =>
              gameEventBus.emit("openOverlay", { overlay: "tutorial" })
            }
          >
            <HelpCircle className="h-4 w-4" />
          </button>
        </div>
        <div className="pixel-progress">
          <span style={{ width: `${(completed / total) * 100}%` }} />
        </div>
        <div className="space-y-1.5">
          {tutorial.steps.map((step) => (
            <div
              key={step.stepKey}
              className="flex items-center gap-2 text-xs font-semibold"
            >
              <CheckCircle2
                className={`h-3.5 w-3.5 ${step.completed ? "text-leaf-700" : "text-[#5e8c52]"}`}
              />
              <span
                className={
                  step.completed
                    ? "text-[#5e8c52] line-through"
                    : "text-[#ddf5d9]"
                }
              >
                {step.title}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
