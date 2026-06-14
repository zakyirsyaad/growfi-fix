"use client";

import { Handshake, MapPin, UserRound } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ResponsivePanel } from "@/components/game/overlays/ResponsivePanel";
import { EmptyState } from "@/components/game/shared/StatusStates";
import { gameEventBus } from "@/lib/game/eventBus";
import { sendTradeInvite } from "@/lib/realtime/socketClient";
import type { OnlinePlayer } from "@/lib/realtime/types";

export function OnlinePlayersOverlay({
  open,
  onOpenChange,
  players,
  room,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  players: OnlinePlayer[];
  room: string;
}) {
  return (
    <ResponsivePanel
      open={open}
      onOpenChange={onOpenChange}
      title="Online Players"
      description="Farmers currently visible in this multiplayer area."
    >
      <div className="mb-3 flex items-center justify-between">
        <span className="pixel-badge gap-1 text-[#8ad4ff]">
          <MapPin className="h-3.5 w-3.5" />
          {room}
        </span>
        <span className="pixel-badge text-[#91d985]">
          {players.length} online
        </span>
      </div>
      {players.length === 0 ? (
        <EmptyState
          title="No other farmers nearby"
          description="Open another account/window to test realtime presence."
        />
      ) : (
        <div className="space-y-3">
          {players.map((player) => (
            <div
              key={player.userId}
              className="pixel-card flex items-center gap-3 p-3"
            >
              <Avatar className="h-10 w-10 rounded-md">
                <AvatarImage src={player.avatarUrl || undefined} />
                <AvatarFallback className="rounded-md">
                  {player.username.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate font-black text-[#f2fbf1]">
                  {player.username}
                </div>
                <div className="text-xs text-[#5e8c52]">
                  {Math.round(player.x)}, {Math.round(player.y)}
                </div>
              </div>
              <button
                type="button"
                className="pixel-btn pixel-btn-ghost px-3 py-2"
                onClick={() => {
                  onOpenChange(false);
                  gameEventBus.emit("openOverlay", {
                    overlay: "playerInteraction",
                    payload: player,
                  });
                }}
              >
                <UserRound className="h-4 w-4" />
                OPEN
              </button>
              <button
                type="button"
                className="pixel-btn pixel-btn-primary px-3 py-2"
                onClick={() => sendTradeInvite(player.userId, room)}
              >
                <Handshake className="h-4 w-4" />
                TRADE
              </button>
            </div>
          ))}
        </div>
      )}
    </ResponsivePanel>
  );
}
