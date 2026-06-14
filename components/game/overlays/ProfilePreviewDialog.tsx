"use client";

import { MapPin, Wallet } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Profile Preview</DialogTitle>
          <DialogDescription>
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
                <div className="text-xl font-black">{player.username}</div>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="gap-1">
                    <MapPin className="h-3.5 w-3.5" />
                    {Math.round(player.x)}, {Math.round(player.y)}
                  </Badge>
                  {player.walletAddress ? (
                    <Badge variant="secondary" className="gap-1">
                      <Wallet className="h-3.5 w-3.5" />
                      wallet connected
                    </Badge>
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
