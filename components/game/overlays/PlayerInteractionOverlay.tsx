"use client";

import { Handshake, Sprout, UserRound } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ResponsivePanel } from "@/components/game/overlays/ResponsivePanel";
import { apiFetch } from "@/lib/utils/fetcher";
import { gameEventBus } from "@/lib/game/eventBus";
import { sendTradeInvite } from "@/lib/realtime/socketClient";
import type { OnlinePlayer } from "@/lib/realtime/types";
import type { PublicFarmResponse } from "@/types/game-data";

export function PlayerInteractionOverlay({
  open,
  onOpenChange,
  player
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  player?: OnlinePlayer;
}) {
  const visitMutation = useMutation({
    mutationFn: (userId: string) => apiFetch<PublicFarmResponse>(`/api/farms/${userId}`),
    onSuccess: (farm) => {
      toast.success(`Visiting ${farm.owner.username}'s farm`);
      onOpenChange(false);
      gameEventBus.emit("visitorFarmLoaded", farm);
    },
    onError: (err) => {
      toast.error("Could not visit farm", {
        description: err instanceof Error ? err.message : "Try again later."
      });
    }
  });

  return (
    <ResponsivePanel
      open={open}
      onOpenChange={onOpenChange}
      title={player ? player.username : "Player"}
      description="Nearby player actions."
    >
      {!player ? null : (
        <div className="space-y-4">
          <Card className="bg-white/82">
            <CardContent className="flex items-center gap-3 p-4">
              <Avatar className="h-12 w-12 rounded-md">
                <AvatarImage src={player.avatarUrl || undefined} />
                <AvatarFallback className="rounded-md">
                  {player.username.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-black">{player.username}</div>
                <div className="text-sm text-muted-foreground">{player.currentRoom}</div>
              </div>
            </CardContent>
          </Card>
          <div className="grid gap-2">
            <Button
              onClick={() => {
                sendTradeInvite(player.userId, player.currentRoom);
                toast.success(`Trade invite sent to ${player.username}`);
              }}
            >
              <Handshake className="h-4 w-4" />
              Invite Trade
            </Button>
            <Button
              variant="secondary"
              disabled={visitMutation.isPending}
              onClick={() => visitMutation.mutate(player.userId)}
            >
              <Sprout className="h-4 w-4" />
              Visit Farm
            </Button>
            <Button variant="secondary" onClick={() => gameEventBus.emit("openOverlay", { overlay: "profile" })}>
              <UserRound className="h-4 w-4" />
              View My Profile
            </Button>
          </div>
        </div>
      )}
    </ResponsivePanel>
  );
}
