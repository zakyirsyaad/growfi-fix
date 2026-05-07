"use client";

import { CalendarDays, Megaphone, Target, Wrench } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ResponsivePanel } from "@/components/game/overlays/ResponsivePanel";

const sections = [
  {
    title: "Announcements",
    icon: Megaphone,
    items: ["Home Farm is now the main gameplay hub.", "Town is open as a public meetup space."]
  },
  {
    title: "Patch Notes",
    icon: Wrench,
    items: ["Seed Shop, Wallet, Marketplace, and Trade Board moved into Home Farm.", "Nearby player trade invites now use accept/decline."]
  },
  {
    title: "Community Goals",
    icon: Target,
    items: ["Harvest 1,000,000 fruits together.", "Complete 5,000 fair direct trades."]
  },
  {
    title: "Event Notices",
    icon: CalendarDays,
    items: ["Harvest Festival coming soon.", "Mutation week is being prepared."]
  }
];

export function CommunityBoardOverlay({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <ResponsivePanel open={open} onOpenChange={onOpenChange} title="Community Board" description="Town updates and community goals.">
      <div className="grid gap-3 sm:grid-cols-2">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.title} className="bg-white/82">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Icon className="h-4 w-4" />
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 p-4 pt-0">
                {section.items.map((item) => (
                  <div key={item} className="rounded-md bg-muted px-3 py-2 text-sm">
                    {item}
                  </div>
                ))}
              </CardContent>
            </Card>
          );
        })}
      </div>
      <Badge variant="outline" className="mt-4 bg-white">
        MVP board data
      </Badge>
    </ResponsivePanel>
  );
}
