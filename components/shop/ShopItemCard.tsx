"use client";

import { ShoppingBasket } from "lucide-react";
import { RarityBadge } from "@/components/game/shared/RarityBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export type ShopItemView = {
  id: string;
  price: number;
  stockRemaining: number;
  stockTotal: number;
  maxBuyPerUser: number;
  purchasedByUser: number;
  seed: {
    name: string;
    iconUrl: string;
    rarity: "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY" | "MYTHIC";
    growTimeSeconds: number;
    harvestCooldownSeconds: number;
    minYield: number;
    maxYield: number;
  };
};

export function ShopItemCard({
  item,
  onBuy,
  disabled,
}: {
  item: ShopItemView;
  onBuy: () => void;
  disabled?: boolean;
}) {
  const remainingForUser = item.maxBuyPerUser - item.purchasedByUser;

  return (
    <Card className="flex h-full flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-14 w-14 place-items-center rounded-lg bg-leaf-100 text-3xl">
            {item.seed.iconUrl}
          </div>
          <div>
            <div className="font-black text-leaf-950">{item.seed.name}</div>
            <RarityBadge rarity={item.seed.rarity} />
          </div>
        </div>
        <div className="text-right">
          <div className="text-xs font-black uppercase text-leaf-700">
            Price
          </div>
          <div className="text-lg font-black">{item.price}</div>
          {item.stockRemaining <= 0 ? (
            <Badge variant="secondary">Sold Out</Badge>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="rounded-lg bg-white/65 p-2">
          <div className="text-xs font-black uppercase text-leaf-700">
            Stock
          </div>
          {item.stockRemaining}/{item.stockTotal}
        </div>
        <div className="rounded-lg bg-white/65 p-2">
          <div className="text-xs font-black uppercase text-leaf-700">
            Limit
          </div>
          {remainingForUser}
        </div>
        <div className="rounded-lg bg-white/65 p-2">
          <div className="text-xs font-black uppercase text-leaf-700">
            Yield
          </div>
          {item.seed.minYield}-{item.seed.maxYield}
        </div>
      </div>

      <Button
        className="mt-auto w-full"
        onClick={onBuy}
        disabled={disabled || item.stockRemaining <= 0 || remainingForUser <= 0}
      >
        <ShoppingBasket size={16} /> Buy 1
      </Button>
    </Card>
  );
}
