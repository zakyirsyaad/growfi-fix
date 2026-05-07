"use client";

import { Handshake, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from "@/components/ui/dialog";
import { acceptTradeInvite, declineTradeInvite } from "@/lib/realtime/socketClient";
import type { TradeInvitePayload } from "@/lib/realtime/types";

export function IncomingTradeInviteDialog({
  invite,
  onClose
}: {
  invite?: TradeInvitePayload | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!invite} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{invite?.from.username || "A farmer"} wants to trade with you</DialogTitle>
          <DialogDescription>
            Accept to open a direct trade session.
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md bg-muted p-3 text-sm">
          <div className="font-semibold">{invite?.from.username}</div>
          <div className="text-muted-foreground">{invite?.room}</div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="secondary"
            onClick={() => {
              if (invite) {
                declineTradeInvite(invite.inviteId);
              }
              onClose();
            }}
          >
            <X className="h-4 w-4" />
            Decline
          </Button>
          <Button
            onClick={() => {
              if (invite) {
                acceptTradeInvite(invite.inviteId);
              }
              onClose();
            }}
          >
            <Handshake className="h-4 w-4" />
            Accept
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
