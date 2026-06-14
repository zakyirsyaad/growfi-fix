"use client";

import { Handshake, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  acceptTradeInvite,
  declineTradeInvite,
} from "@/lib/realtime/socketClient";
import type { TradeInvitePayload } from "@/lib/realtime/types";

export function IncomingTradeInviteDialog({
  invite,
  onClose,
}: {
  invite?: TradeInvitePayload | null;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!invite} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="scanlines border-2 border-[#3d9f4b] bg-[#0d2614] text-[#ddf5d9] [&>button]:text-[#91d985] [&>button:hover]:text-[#f7d767]">
        <DialogHeader>
          <DialogTitle className="pixel-heading text-sm text-[#f2fbf1]">
            {invite?.from.username || "A farmer"} wants to trade with you
          </DialogTitle>
          <DialogDescription className="font-sans text-[#91d985]">
            Accept to open a direct trade session.
          </DialogDescription>
        </DialogHeader>
        <div className="pixel-card-sunken p-3 text-sm">
          <div className="font-semibold text-[#f2fbf1]">
            {invite?.from.username}
          </div>
          <div className="text-[#91d985]">{invite?.room}</div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <button
            type="button"
            className="pixel-btn pixel-btn-ghost px-4 py-2"
            onClick={() => {
              if (invite) {
                declineTradeInvite(invite.inviteId);
              }
              onClose();
            }}
          >
            <X className="h-4 w-4" />
            DECLINE
          </button>
          <button
            type="button"
            className="pixel-btn pixel-btn-primary px-4 py-2"
            onClick={() => {
              if (invite) {
                acceptTradeInvite(invite.inviteId);
              }
              onClose();
            }}
          >
            <Handshake className="h-4 w-4" />
            ACCEPT
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
