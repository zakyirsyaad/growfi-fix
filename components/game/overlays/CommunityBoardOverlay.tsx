"use client";

import { CalendarDays, Megaphone, Target, Wrench } from "lucide-react";
import { ResponsivePanel } from "@/components/game/overlays/ResponsivePanel";

const sections = [
  {
    title: "Announcements",
    icon: Megaphone,
    items: [
      "Home Farm is now the main gameplay hub.",
      "Town is open as a public meetup space.",
    ],
  },
  {
    title: "Patch Notes",
    icon: Wrench,
    items: [
      "Seed Shop, Wallet, Marketplace, and Trade Board moved into Home Farm.",
      "Nearby player trade invites now use accept/decline.",
    ],
  },
  {
    title: "Community Goals",
    icon: Target,
    items: [
      "Harvest 1,000,000 fruits together.",
      "Complete 5,000 fair direct trades.",
    ],
  },
  {
    title: "Event Notices",
    icon: CalendarDays,
    items: [
      "Harvest Festival coming soon.",
      "Mutation week is being prepared.",
    ],
  },
];

export function CommunityBoardOverlay({
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
      title="Community Board"
      description="Town updates and community goals."
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <div key={section.title} className="pixel-card p-4">
              <div className="flex items-center gap-2 text-base font-bold text-[#f2fbf1]">
                <Icon className="h-4 w-4" />
                {section.title}
              </div>
              <div className="mt-2 space-y-2">
                {section.items.map((item) => (
                  <div
                    key={item}
                    className="pixel-card-sunken px-3 py-2 text-sm text-[#ddf5d9]"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
      <span className="pixel-badge text-[#5e8c52] mt-4">MVP board data</span>
    </ResponsivePanel>
  );
}
