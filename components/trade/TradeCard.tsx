"use client";

import { CheckCircle2, X } from "lucide-react";
import { MutationBadge } from "@/components/game/shared/MutationBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Countdown } from "@/components/ui/countdown";

export type TradeView = {
  id: string;
  initiatorId: string;
  recipientId: string;
  status: "PENDING" | "ACTIVE" | "LOCKED" | "COMPLETED" | "CANCELLED" | "EXPIRED";
  initiatorConfirmed: boolean;
  recipientConfirmed: boolean;
  expiresAt: string;
  initiator: { id: string; username: string };
  recipient: { id: string; username: string };
  items: Array<{
    id: string;
    userId: string;
    type: "FRUIT" | "GROW";
    quantity: number;
    growAmount: number;
    mutation?: "NORMAL" | "BIG" | "SWEET" | "GOLDEN" | "CRYSTAL" | "RAINBOW" | null;
    fruit?: { name: string; iconUrl: string } | null;
    user: { id: string; username: string };
  }>;
};

export function TradeCard({
  trade,
  currentUserId,
  onConfirm,
  onCancel,
  onRemoveItem,
  busy
}: {
  trade: TradeView;
  currentUserId: string;
  onConfirm: () => void;
  onCancel: () => void;
  onRemoveItem: (itemId: string) => void;
  busy?: boolean;
}) {
  const other = trade.initiatorId === currentUserId ? trade.recipient : trade.initiator;
  const myConfirmed =
    trade.initiatorId === currentUserId ? trade.initiatorConfirmed : trade.recipientConfirmed;
  const theirConfirmed =
    trade.initiatorId === currentUserId ? trade.recipientConfirmed : trade.initiatorConfirmed;
  const active = ["PENDING", "ACTIVE", "LOCKED"].includes(trade.status);

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase text-leaf-700">Trade with</div>
          <div className="text-xl font-black">{other.username}</div>
        </div>
        <div className="text-right">
          <div className="rounded-full bg-white/75 px-3 py-1 text-xs font-black uppercase text-leaf-700">
            {trade.status.toLowerCase()}
          </div>
          {active ? (
            <div className="mt-2 text-sm font-bold text-leaf-800">
              <Countdown to={trade.expiresAt} />
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {[trade.initiator, trade.recipient].map((user) => (
          <div key={user.id} className="rounded-lg bg-white/65 p-3">
            <div className="mb-2 flex items-center justify-between">
              <div className="font-black">{user.username}</div>
              {(user.id === trade.initiatorId
                ? trade.initiatorConfirmed
                : trade.recipientConfirmed) ? (
                <span className="inline-flex items-center gap-1 text-xs font-black text-leaf-700">
                  <CheckCircle2 size={14} /> confirmed
                </span>
              ) : null}
            </div>
            <div className="space-y-2">
              {trade.items.filter((item) => item.userId === user.id).length === 0 ? (
                <div className="text-sm font-bold text-leaf-700">No items.</div>
              ) : null}
              {trade.items
                .filter((item) => item.userId === user.id)
                .map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-2 rounded-lg bg-white/75 px-2 py-2 text-sm"
                  >
                    <span className="font-bold">
                      {item.type === "GROW"
                        ? `${item.growAmount} $GROW`
                        : `${item.fruit?.iconUrl || ""} ${item.quantity} ${item.fruit?.name || "Fruit"}`}
                    </span>
                    <span className="flex items-center gap-2">
                      {item.mutation ? <MutationBadge mutation={item.mutation} /> : null}
                      {active && item.userId === currentUserId ? (
                        <button
                          onClick={() => onRemoveItem(item.id)}
                          className="rounded-md p-1 text-berry-700 hover:bg-berry-100"
                        >
                          <X size={14} />
                        </button>
                      ) : null}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        ))}
      </div>

      {active ? (
        <div className="flex flex-wrap gap-2">
          <Button onClick={onConfirm} disabled={busy || myConfirmed}>
            Confirm
          </Button>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <div className="ml-auto text-sm font-bold text-leaf-800">
            You: {myConfirmed ? "confirmed" : "open"} · Them:{" "}
            {theirConfirmed ? "confirmed" : "open"}
          </div>
        </div>
      ) : null}
    </Card>
  );
}
