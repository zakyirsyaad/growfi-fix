"use client";

import { Handshake, MessageCircle, Sprout, UserRound, X } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ResponsivePanel } from "@/components/game/overlays/ResponsivePanel";
import { apiFetch } from "@/lib/utils/fetcher";
import { gameEventBus } from "@/lib/game/eventBus";
import { sendTradeInvite } from "@/lib/realtime/socketClient";
import type { OnlinePlayer } from "@/lib/realtime/types";
import type { PublicFarmResponse } from "@/types/game-data";

export function PlayerInteractionOverlay({
  open,
  onOpenChange,
  player,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  player?: OnlinePlayer;
}) {
  const visitMutation = useMutation({
    mutationFn: (userId: string) =>
      apiFetch<PublicFarmResponse>(`/api/farms/${userId}`),
    onSuccess: (farm) => {
      toast.success(`Visiting ${farm.owner.username}'s farm`);
      onOpenChange(false);
      gameEventBus.emit("visitorFarmLoaded", farm);
    },
    onError: (err) => {
      toast.error("Could not visit farm", {
        description: err instanceof Error ? err.message : "Try again later.",
      });
    },
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
          <div className="pixel-card flex items-center gap-3 p-4">
            <Avatar className="h-12 w-12 rounded-md">
              <AvatarImage src={player.avatarUrl || undefined} />
              <AvatarFallback className="rounded-md">
                {player.username.slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="font-black text-[#f2fbf1]">{player.username}</div>
              <div className="text-sm text-[#91d985]">
                {player.currentRoom}
              </div>
            </div>
          </div>
          <div className="grid gap-2">
            <button
              type="button"
              className="pixel-btn pixel-btn-primary px-4 py-2"
              onClick={() => {
                sendTradeInvite(player.userId, player.currentRoom);
                toast.success(`Trade invite sent to ${player.username}`);
                onOpenChange(false);
              }}
            >
              <Handshake className="h-4 w-4" />
              INVITE TRADE
            </button>
            <button
              type="button"
              className="pixel-btn pixel-btn-ghost px-4 py-2"
              disabled={visitMutation.isPending}
              onClick={() => visitMutation.mutate(player.userId)}
            >
              <Sprout className="h-4 w-4" />
              VISIT FARM
            </button>
            <button
              type="button"
              className="pixel-btn pixel-btn-ghost px-4 py-2"
              onClick={() => {
                gameEventBus.emit("openOverlay", {
                  overlay: "profilePreview",
                  payload: player,
                });
              }}
            >
              <UserRound className="h-4 w-4" />
              VIEW PROFILE
            </button>
            <button
              type="button"
              className="pixel-btn pixel-btn-ghost px-4 py-2"
              onClick={() => {
                gameEventBus.emit("openOverlay", { overlay: "localChat" });
                onOpenChange(false);
              }}
            >
              <MessageCircle className="h-4 w-4" />
              WHISPER / CHAT
            </button>
            <button
              type="button"
              className="pixel-btn pixel-btn-ghost px-4 py-2"
              onClick={() => onOpenChange(false)}
            >
              <X className="h-4 w-4" />
              CANCEL
            </button>
          </div>
        </div>
      )}
    </ResponsivePanel>
  );
}
