"use client";

import { CheckCircle2, Coins, Gift, Sprout } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
  "Use $GROW to upgrade farm",
];

export function TutorialOnboardingDialog({
  open,
  onOpenChange,
  garden,
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
        body: JSON.stringify({ skip: true }),
      }),
    onSuccess: async () => {
      toast("Tutorial skipped", {
        description: "You can reopen it from the Help menu.",
      });
      await queryClient.invalidateQueries({ queryKey: ["garden"] });
    },
    onError: (err) => {
      toast.error("Could not skip tutorial", {
        description: err instanceof Error ? err.message : "Try again.",
      });
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl scanlines border-2 border-[#3d9f4b] bg-[#0d2614] text-[#ddf5d9] [&>button]:text-[#91d985] [&>button:hover]:text-[#f7d767]">
        <DialogHeader>
          <DialogTitle className="pixel-heading text-sm text-[#f2fbf1]">
            Welcome to GrowFi
          </DialogTitle>
          <DialogDescription className="font-sans text-[#91d985]">
            A quick starter path for turning an empty farm into your first $GROW
            loop.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2">
          {onboardingSteps.map((step, index) => (
            <div
              key={step}
              className="pixel-card-sunken flex items-center gap-3 p-3 text-sm font-semibold"
            >
              <span className="pixel-tile grid h-7 w-7 shrink-0 place-items-center text-xs font-black">
                {index + 1}
              </span>
              {step}
            </div>
          ))}
        </div>

        <div className="pixel-card-sunken p-3">
          <div className="flex items-center gap-2 font-black text-[#f2fbf1]">
            <Gift className="h-4 w-4 text-[#f7d767]" />
            Tutorial Reward
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <span className="pixel-badge text-[#f7d767]">
              <Coins className="h-3.5 w-3.5" />
              {reward?.grow ?? 25} $GROW
            </span>
            {(reward?.starterSeeds || []).map((seed) => (
              <span key={seed.seedSlug} className="pixel-badge text-[#91d985]">
                <Sprout className="h-3.5 w-3.5" />
                {seed.quantity} {seed.seedSlug} seeds
              </span>
            ))}
          </div>
        </div>

        {garden?.tutorial?.completed ? (
          <div className="pixel-card-sunken flex items-center gap-2 p-3 text-sm font-bold text-[#3d9f4b]">
            <CheckCircle2 className="h-4 w-4" />
            Tutorial completed.
          </div>
        ) : null}

        <DialogFooter className="gap-2 sm:gap-0">
          {!garden?.tutorial?.completed ? (
            <button
              type="button"
              className="pixel-btn pixel-btn-ghost px-4 py-2"
              disabled={skipMutation.isPending}
              onClick={() => {
                window.localStorage.setItem("growfi:tutorial-skipped", "1");
                onOpenChange(false);
                skipMutation.mutate();
              }}
            >
              SKIP
            </button>
          ) : null}
          <button
            type="button"
            className="pixel-btn pixel-btn-primary px-4 py-2"
            onClick={() => onOpenChange(false)}
          >
            {garden?.tutorial?.completed ? "CLOSE" : "START TUTORIAL"}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
