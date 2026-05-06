"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ShoppingBasket } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ResponsivePanel } from "@/components/game/overlays/ResponsivePanel";
import { CountdownBadge } from "@/components/game/shared/CountdownBadge";
import { RarityBadge } from "@/components/game/shared/RarityBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/game/shared/StatusStates";
import { apiFetch } from "@/lib/utils/fetcher";
import type { Rarity } from "@/types/game-data";

type ShopItemView = {
  id: string;
  price: number;
  stockRemaining: number;
  stockTotal: number;
  maxBuyPerUser: number;
  purchasedByUser: number;
  seed: {
    id: string;
    name: string;
    iconUrl: string;
    rarity: Rarity;
    growTimeSeconds: number;
    harvestCooldownSeconds: number;
    minYield: number;
    maxYield: number;
  };
};

type ShopResponse = {
  rotation: { id: string; startsAt: string; endsAt: string; status: string };
  items: ShopItemView[];
};

export function SeedShopOverlay({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["shop"],
    queryFn: () => apiFetch<ShopResponse>("/api/shop/current"),
    refetchInterval: 15_000,
    enabled: open
  });

  const buyMutation = useMutation({
    mutationFn: (shopItemId: string) =>
      apiFetch("/api/shop/buy", {
        method: "POST",
        body: JSON.stringify({ shopItemId, quantity: 1 })
      }),
    onSuccess: async () => {
      setError(null);
      toast.success("Seed bought");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["shop"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["garden"] }),
        queryClient.invalidateQueries({ queryKey: ["me"] })
      ]);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Purchase failed")
  });

  return (
    <ResponsivePanel
      open={open}
      onOpenChange={onOpenChange}
      title="Seed Shop"
      description="Global rotating stock. Every farmer buys from the same limited rotation."
      wide
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <CountdownBadge to={data?.rotation.endsAt} label="Next refresh" />
        <Badge variant="outline" className="bg-white/80">
          $GROW balance updates after each purchase
        </Badge>
      </div>
      {error ? <div className="mb-3"><ErrorState message={error} /></div> : null}
      {isLoading || !data ? (
        <LoadingState label="Loading seed shop" />
      ) : data.items.length === 0 ? (
        <EmptyState title="No shop stock" description="The next global rotation will refill the shelves." />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.items.map((item) => {
            const remainingForUser = item.maxBuyPerUser - item.purchasedByUser;
            const stockPercent = item.stockTotal > 0 ? (item.stockRemaining / item.stockTotal) * 100 : 0;
            return (
              <Card key={item.id} className="bg-white/82">
                <CardContent className="space-y-3 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-14 w-14 place-items-center rounded-md bg-secondary text-3xl">
                        {item.seed.iconUrl}
                      </span>
                      <div>
                        <div className="font-bold">{item.seed.name}</div>
                        <div className="mt-1">
                          <RarityBadge rarity={item.seed.rarity} />
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xs font-semibold text-muted-foreground">Price</div>
                      <div className="text-xl font-bold">{item.price}</div>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold text-muted-foreground">
                      <span>Global stock</span>
                      <span>
                        {item.stockRemaining}/{item.stockTotal}
                      </span>
                    </div>
                    <Progress value={stockPercent} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-sm">
                    <div className="rounded-md bg-muted p-2">
                      <div className="text-xs font-semibold text-muted-foreground">Limit</div>
                      {remainingForUser}
                    </div>
                    <div className="rounded-md bg-muted p-2">
                      <div className="text-xs font-semibold text-muted-foreground">Grow</div>
                      {Math.round(item.seed.growTimeSeconds / 60)}m
                    </div>
                    <div className="rounded-md bg-muted p-2">
                      <div className="text-xs font-semibold text-muted-foreground">Yield</div>
                      {item.seed.minYield}-{item.seed.maxYield}
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    disabled={buyMutation.isPending || item.stockRemaining <= 0 || remainingForUser <= 0}
                    onClick={() => buyMutation.mutate(item.id)}
                  >
                    <ShoppingBasket className="h-4 w-4" />
                    Buy 1 Seed
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </ResponsivePanel>
  );
}
