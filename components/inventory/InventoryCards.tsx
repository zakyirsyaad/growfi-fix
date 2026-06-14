"use client";

import { useState } from "react";
import { MutationBadge } from "@/components/game/shared/MutationBadge";
import { RarityBadge } from "@/components/game/shared/RarityBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils/cn";

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
      <Card className="p-8 text-center text-muted-foreground font-medium shadow-sm">
        No seeds in your bag.
      </Card>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
      {seeds.map((stack) => (
        <Card
          key={stack.id}
          className="p-5 flex items-center justify-between gap-4 shadow-sm relative"
        >
          <div className="flex items-center gap-4">
            <span className="grid h-14 w-14 place-items-center rounded-xl bg-muted border border-border text-3xl">
              {stack.seed.iconUrl || "🌱"}
            </span>
            <div>
              <div className="text-lg text-foreground font-bold mb-1">
                {stack.seed.name}
              </div>
              <RarityBadge rarity={stack.seed.rarity} />
            </div>
          </div>
          <div className="text-3xl font-black text-foreground opacity-80">
            x{stack.quantity}
          </div>
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
  onList?: (fruit: FruitStackView, quantity: number) => void;
  busyId?: string | null;
}) {
  const [amounts, setAmounts] = useState<Record<string, string>>({});

  if (fruits.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground font-medium shadow-sm">
        No fruit harvested yet.
      </Card>
    );
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
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

        const isBusy = busyId === stack.id;

        return (
          <Card
            key={stack.id}
            className={cn(
              "p-5 flex flex-col space-y-4 shadow-sm relative",
              isBusy ? "opacity-50 pointer-events-none grayscale" : "",
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-4">
                <span className="grid h-14 w-14 place-items-center rounded-xl bg-muted border border-border text-3xl">
                  {stack.fruit.iconUrl || "🍎"}
                </span>
                <div>
                  <div className="text-lg text-foreground font-bold mb-1">
                    {stack.fruit.name}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    <RarityBadge rarity={stack.fruit.rarity} />
                    <MutationBadge mutation={stack.mutation} />
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black text-foreground">
                  x{stack.quantity}
                </div>
                <div className="text-xs font-bold text-primary opacity-80 mt-1">
                  {available} unlocked
                </div>
              </div>
            </div>

            {onSell ? (
              <div className="space-y-2 mt-2 bg-muted/50 p-3 rounded-lg border border-border">
                <div className="flex items-center gap-2">
                  <Input
                    className="bg-background border-border h-9"
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
                    className="h-9 px-3 font-bold"
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
                <div className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
                  Owned: {stack.quantity} · Locked: {stack.lockedQuantity}
                  {amountMessage ? ` · ${amountMessage}` : ""}
                </div>
              </div>
            ) : null}

            <div className="flex gap-2 pt-2 mt-auto">
              {onSell ? (
                <Button
                  variant="secondary"
                  className="flex-1 rounded-xl font-bold py-2.5 h-auto"
                  onClick={() => onSell(stack, amount)}
                  disabled={available <= 0 || !amountValid || isBusy}
                >
                  Sell
                </Button>
              ) : null}
              {onList ? (
                <Button
                  variant="default"
                  className="flex-1 rounded-xl font-bold py-2.5 h-auto"
                  onClick={() => onList(stack, amount)}
                  disabled={available <= 0 || !amountValid || isBusy}
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
