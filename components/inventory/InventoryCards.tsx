"use client";

import { MutationBadge } from "@/components/game/shared/MutationBadge";
import { RarityBadge } from "@/components/game/shared/RarityBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export type SeedStackView = {
  id: string;
  quantity: number;
  seed: {
    name: string;
    iconUrl: string;
    rarity: "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY" | "MYTHIC";
  };
};

export type FruitStackView = {
  id: string;
  quantity: number;
  lockedQuantity: number;
  mutation: "NORMAL" | "BIG" | "SWEET" | "GOLDEN" | "CRYSTAL" | "RAINBOW";
  fruit: {
    name: string;
    iconUrl: string;
    rarity: "COMMON" | "UNCOMMON" | "RARE" | "EPIC" | "LEGENDARY" | "MYTHIC";
    baseSellPrice: number;
  };
};

export function SeedCards({ seeds }: { seeds: SeedStackView[] }) {
  if (seeds.length === 0) {
    return (
      <Card className="text-sm font-bold text-leaf-800">
        No seeds in your bag.
      </Card>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {seeds.map((stack) => (
        <Card
          key={stack.id}
          className="flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-3">
            <span className="grid h-12 w-12 place-items-center rounded-lg bg-leaf-100 text-2xl">
              {stack.seed.iconUrl}
            </span>
            <div>
              <div className="font-black">{stack.seed.name}</div>
              <RarityBadge rarity={stack.seed.rarity} />
            </div>
          </div>
          <div className="text-2xl font-black">x{stack.quantity}</div>
        </Card>
      ))}
    </div>
  );
}

export function FruitCards({
  fruits,
  onSell,
  onList,
  busyId,
}: {
  fruits: FruitStackView[];
  onSell?: (fruit: FruitStackView) => void;
  onList?: (fruit: FruitStackView) => void;
  busyId?: string | null;
}) {
  if (fruits.length === 0) {
    return (
      <Card className="text-sm font-bold text-leaf-800">
        No fruit harvested yet.
      </Card>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {fruits.map((stack) => {
        const available = stack.quantity - stack.lockedQuantity;
        return (
          <Card key={stack.id} className="space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-12 w-12 place-items-center rounded-lg bg-gold-100 text-2xl">
                  {stack.fruit.iconUrl}
                </span>
                <div>
                  <div className="font-black">{stack.fruit.name}</div>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <RarityBadge rarity={stack.fruit.rarity} />
                    <MutationBadge mutation={stack.mutation} />
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black">x{stack.quantity}</div>
                <div className="text-xs font-bold text-leaf-700">
                  {available} unlocked
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              {onSell ? (
                <Button
                  className="flex-1"
                  size="sm"
                  onClick={() => onSell(stack)}
                  disabled={available <= 0 || busyId === stack.id}
                >
                  Sell 1
                </Button>
              ) : null}
              {onList ? (
                <Button
                  className="flex-1"
                  size="sm"
                  variant="secondary"
                  onClick={() => onList(stack)}
                  disabled={available <= 0 || busyId === stack.id}
                >
                  List
                </Button>
              ) : null}
            </div>
          </Card>
        );
      })}
    </div>
  );
}
