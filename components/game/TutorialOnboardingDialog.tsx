"use client";

import { CheckCircle2, Coins, Gift, Sprout } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { apiFetch } from "@/lib/utils/fetcher";
import type { GardenResponse } from "@/types/game-data";

const onboardingSteps = [
  "Buy seeds from Seed Shop Stall",
  "Plant seeds on empty plots",
  "Water plants using Water Well",
  "Wait for crops to grow",
  "Harvest fruits",
  "Sell fruits or list them on marketplace",
  "Use $GROW to upgrade farm"
];

export function TutorialOnboardingDialog({
  open,
  onOpenChange,
  garden
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  garden?: GardenResponse;
}) {
  const queryClient = useQueryClient();
  const reward = garden?.tutorial?.reward;
  const skipMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/tutorial", {
        method: "POST",
        body: JSON.stringify({ skip: true })
      }),
    onSuccess: async () => {
      toast("Tutorial skipped", {
        description: "You can reopen it from the Help menu."
      });
      await queryClient.invalidateQueries({ queryKey: ["garden"] });
    },
    onError: (err) => {
      toast.error("Could not skip tutorial", {
        description: err instanceof Error ? err.message : "Try again."
      });
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Welcome to GrowFi</DialogTitle>
          <DialogDescription>
            A quick starter path for turning an empty farm into your first $GROW loop.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          {onboardingSteps.map((step, index) => (
            <div key={step} className="flex items-center gap-3 rounded-md bg-muted p-3 text-sm font-semibold">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-white text-xs font-black">
                {index + 1}
              </span>
              {step}
            </div>
          ))}
        </div>

        <div className="rounded-md border bg-white/75 p-3">
          <div className="flex items-center gap-2 font-black">
            <Gift className="h-4 w-4 text-gold-700" />
            Tutorial Reward
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Badge variant="legendary" className="gap-1">
              <Coins className="h-3.5 w-3.5" />
              {reward?.grow ?? 25} $GROW
            </Badge>
            {(reward?.starterSeeds || []).map((seed) => (
              <Badge key={seed.seedSlug} variant="outline" className="gap-1 bg-white">
                <Sprout className="h-3.5 w-3.5" />
                {seed.quantity} {seed.seedSlug} seeds
              </Badge>
            ))}
          </div>
        </div>

        {garden?.tutorial?.completed ? (
          <div className="flex items-center gap-2 rounded-md bg-leaf-50 p-3 text-sm font-bold text-leaf-900">
            <CheckCircle2 className="h-4 w-4" />
            Tutorial completed.
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          {!garden?.tutorial?.completed ? (
            <Button
              variant="secondary"
              disabled={skipMutation.isPending}
              onClick={() => {
                window.localStorage.setItem("growfi:tutorial-skipped", "1");
                onOpenChange(false);
                skipMutation.mutate();
              }}
            >
              Skip
            </Button>
          ) : null}
          <Button onClick={() => onOpenChange(false)}>
            {garden?.tutorial?.completed ? "Close" : "Start Tutorial"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
