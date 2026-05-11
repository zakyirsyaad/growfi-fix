"use client";

import { CheckCircle2, Gift, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { gameEventBus } from "@/lib/game/eventBus";
import type { GardenResponse } from "@/types/game-data";

export function TutorialQuestOverlay({
  garden,
  visible
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
      <Card className="pointer-events-auto bg-white/90 shadow-sm backdrop-blur">
        <CardContent className="space-y-3 p-3">
          <div className="flex items-start justify-between gap-2">
            <div>
              <div className="flex items-center gap-2 text-sm font-black">
                <Gift className="h-4 w-4 text-gold-700" />
                Tutorial Quest
              </div>
              <div className="text-xs text-muted-foreground">
                {completed}/{total} steps complete
              </div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={() => gameEventBus.emit("openOverlay", { overlay: "tutorial" })}
            >
              <HelpCircle className="h-4 w-4" />
            </Button>
          </div>
          <Progress value={(completed / total) * 100} />
          <div className="space-y-1.5">
            {tutorial.steps.map((step) => (
              <div key={step.stepKey} className="flex items-center gap-2 text-xs font-semibold">
                <CheckCircle2
                  className={`h-3.5 w-3.5 ${step.completed ? "text-leaf-700" : "text-muted-foreground/45"}`}
                />
                <span className={step.completed ? "text-muted-foreground line-through" : ""}>
                  {step.title}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
