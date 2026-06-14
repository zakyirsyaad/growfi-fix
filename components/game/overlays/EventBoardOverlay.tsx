"use client";

import { Gift, Sprout, Trophy } from "lucide-react";
import { ResponsivePanel } from "@/components/game/overlays/ResponsivePanel";

export function EventBoardOverlay({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <ResponsivePanel
      open={open}
      onOpenChange={onOpenChange}
      title="Town Events"
      description="Seasonal events and global goals."
    >
      <div className="space-y-4">
        <div className="pixel-card p-4">
          <div className="flex items-center gap-2 text-base font-bold text-[#f2fbf1]">
            <Sprout className="h-4 w-4" />
            Harvest Festival
            <span className="pixel-badge text-[#8ad4ff] ml-auto">
              coming soon
            </span>
          </div>
          <div className="mt-3 space-y-3">
            <div className="text-sm text-[#91d985]">
              Global Goal: Harvest 1,000,000 fruits
            </div>
            <div className="pixel-progress">
              <span style={{ width: `${18}%` }} />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="pixel-card-sunken p-3 text-sm text-[#ddf5d9]">
                <Trophy className="mb-2 h-4 w-4" />
                Leaderboard prizes planned
              </div>
              <div className="pixel-card-sunken p-3 text-sm text-[#ddf5d9]">
                <Gift className="mb-2 h-4 w-4" />
                Rare seed rewards planned
              </div>
            </div>
          </div>
        </div>
      </div>
    </ResponsivePanel>
  );
}
