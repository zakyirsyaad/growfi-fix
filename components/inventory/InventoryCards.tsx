"use client";

import { useState } from "react";
import { MutationBadge } from "@/components/game/shared/MutationBadge";
import { RarityBadge } from "@/components/game/shared/RarityBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

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
    baseSellPrice?: number;
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
  onSell?: (fruit: FruitStackView, quantity: number) => void;
  onList?: (fruit: FruitStackView) => void;
  busyId?: string | null;
}) {
  const [amounts, setAmounts] = useState<Record<string, string>>({});

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
        const amountText = amounts[stack.id] ?? "1";
        const amount = Number(amountText);
        const amountValid =
          Number.isInteger(amount) && amount >= 1 && amount <= available;
        const amountMessage =
          amountText.trim() === ""
            ? "Enter at least 1 fruit."
            : !Number.isInteger(amount) || amount < 1
            ? "Enter at least 1 fruit."
            : amount > available
            ? `You only have ${available} available.`
            : null;
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
            {onSell ? (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={available}
                    step={1}
                    value={amountText}
                    onChange={(event) =>
                      setAmounts((current) => ({
                        ...current,
                        [stack.id]: event.target.value,
                      }))
                    }
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={available <= 0}
                    onClick={() =>
                      setAmounts((current) => ({
                        ...current,
                        [stack.id]: String(Math.max(1, available)),
                      }))
                    }
                  >
                    Max
                  </Button>
                </div>
                <div className="text-xs font-semibold text-muted-foreground">
                  Owned {stack.quantity} · Locked {stack.lockedQuantity}
                  {amountMessage ? ` · ${amountMessage}` : ""}
                </div>
              </div>
            ) : null}
            <div className="flex gap-2">
              {onSell ? (
                <Button
                  className="flex-1"
                  size="sm"
                  onClick={() => {
                    if (process.env.NODE_ENV === "development") {
                      console.debug("[GrowFi] sell fruit selected", {
                        fruitStackId: stack.id,
                        fruit: stack.fruit.name,
                        mutation: stack.mutation,
                        ownedQty: stack.quantity,
                        lockedQty: stack.lockedQuantity,
                        amount,
                      });
                    }
                    onSell(stack, amount);
                  }}
                  disabled={
                    available <= 0 || !amountValid || busyId === stack.id
                  }
                >
                  Sell
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
