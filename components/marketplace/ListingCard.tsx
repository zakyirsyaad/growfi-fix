"use client";

import { Clock, ShoppingCart, X } from "lucide-react";
import { MutationBadge } from "@/components/game/shared/MutationBadge";
import { RarityBadge } from "@/components/game/shared/RarityBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Countdown } from "@/components/ui/countdown";

export type ListingView = {
  id: string;
  sellerId: string;
  quantity: number;
  price: number;
  mutation: "NORMAL" | "BIG" | "SWEET" | "GOLDEN" | "CRYSTAL" | "RAINBOW";
  status: "ACTIVE" | "SOLD" | "CANCELLED" | "EXPIRED";
  expiresAt: string;
  fruit: {
    name: string;
    iconUrl: string;
    rarity: "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY" | "MYTHIC";
  };
  seller?: { id: string; username: string; avatarUrl?: string | null };
};

export function ListingCard({
  listing,
  currentUserId,
  onBuy,
  onCancel,
  busy,
}: {
  listing: ListingView;
  currentUserId?: string;
  onBuy?: () => void;
  onCancel?: () => void;
  busy?: boolean;
}) {
  const mine = listing.sellerId === currentUserId;

  return (
    <Card className="space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="grid h-12 w-12 place-items-center rounded-lg bg-gold-100 text-2xl">
            {listing.fruit.iconUrl}
          </span>
          <div>
            <div className="font-black">{listing.fruit.name}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              <RarityBadge rarity={listing.fruit.rarity} />
              <MutationBadge mutation={listing.mutation} />
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-black uppercase text-leaf-700">
            Price
          </div>
          <div className="text-xl font-black">{listing.price}</div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-lg bg-white/65 p-2">
          <div className="text-xs font-black uppercase text-leaf-700">Qty</div>
          {listing.quantity}
        </div>
        <div className="rounded-lg bg-white/65 p-2">
          <div className="text-xs font-black uppercase text-leaf-700">
            Seller
          </div>
          {listing.seller?.username || "You"}
        </div>
        <div className="rounded-lg bg-white/65 p-2">
          <div className="flex items-center gap-1 text-xs font-black uppercase text-leaf-700">
            <Clock size={12} /> Ends
          </div>
          <Countdown to={listing.expiresAt} />
        </div>
      </div>

      {listing.status === "ACTIVE" ? (
        mine ? (
          <Button
            className="w-full"
            variant="secondary"
            onClick={onCancel}
            disabled={busy}
          >
            <X size={16} /> Cancel
          </Button>
        ) : (
          <Button className="w-full" onClick={onBuy} disabled={busy}>
            <ShoppingCart size={16} /> Buy
          </Button>
        )
      ) : (
        <div className="rounded-lg bg-white/65 px-3 py-2 text-sm font-black text-leaf-800">
          {listing.status.toLowerCase()}
        </div>
      )}
    </Card>
  );
}
