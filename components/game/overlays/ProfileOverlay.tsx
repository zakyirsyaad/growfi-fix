"use client";

import { ResponsivePanel } from "@/components/game/overlays/ResponsivePanel";
import { ProfileDashboard } from "@/components/profile/ProfileDashboard";

export function ProfileOverlay({
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
      title="Profile"
      description="Discord identity, wallet, garden stats, and recent activity."
      wide
    >
      <div className="pixel-scope">
        <ProfileDashboard compact />
      </div>
    </ResponsivePanel>
  );
}
