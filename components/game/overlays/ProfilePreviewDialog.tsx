"use client";

import { MapPin, Wallet } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { OnlinePlayer } from "@/lib/realtime/types";

export function ProfilePreviewDialog({
  open,
  onOpenChange,
  player,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  player?: OnlinePlayer;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="scanlines border-2 border-[#3d9f4b] bg-[#0d2614] text-[#ddf5d9] [&>button]:text-[#91d985] [&>button:hover]:text-[#f7d767]">
        <DialogHeader>
          <DialogTitle className="pixel-heading text-sm text-[#f2fbf1]">
            Profile Preview
          </DialogTitle>
          <DialogDescription className="font-sans text-[#91d985]">
            {player?.currentRoom || "Nearby farmer"}
          </DialogDescription>
        </DialogHeader>
        {player ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-14 w-14 rounded-md">
                <AvatarImage src={player.avatarUrl || undefined} />
                <AvatarFallback className="rounded-md">
                  {player.username.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="text-xl font-black text-[#f2fbf1]">
                  {player.username}
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className="pixel-badge text-[#8ad4ff] gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {Math.round(player.x)}, {Math.round(player.y)}
                  </span>
                  {player.walletAddress ? (
                    <span className="pixel-badge text-[#f7d767] gap-1">
                      <Wallet className="h-3.5 w-3.5" />
                      wallet connected
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
