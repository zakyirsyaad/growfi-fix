"use client";

import { Gift, Sprout, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
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
        <Card className="bg-white/82">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              <Sprout className="h-4 w-4" />
              Harvest Festival
              <Badge variant="secondary" className="ml-auto">
                coming soon
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 p-4 pt-0">
            <div className="text-sm text-muted-foreground">
              Global Goal: Harvest 1,000,000 fruits
            </div>
            <Progress value={18} />
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="rounded-md bg-muted p-3 text-sm">
                <Trophy className="mb-2 h-4 w-4" />
                Leaderboard prizes planned
              </div>
              <div className="rounded-md bg-muted p-3 text-sm">
                <Gift className="mb-2 h-4 w-4" />
                Rare seed rewards planned
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </ResponsivePanel>
  );
}
