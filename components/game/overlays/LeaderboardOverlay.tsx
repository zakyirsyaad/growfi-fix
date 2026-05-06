"use client";

import { ResponsivePanel } from "@/components/game/overlays/ResponsivePanel";
import { LeaderboardDashboard } from "@/components/leaderboard/LeaderboardDashboard";

export function LeaderboardOverlay({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <ResponsivePanel open={open} onOpenChange={onOpenChange} title="Leaderboard" description="Top farmers across harvesting, balance, trading, and marketplace sales." wide>
      <LeaderboardDashboard compact />
    </ResponsivePanel>
  );
}
