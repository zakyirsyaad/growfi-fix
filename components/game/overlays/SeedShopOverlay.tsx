"use client";

import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw, ShoppingBasket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ResponsivePanel } from "@/components/game/overlays/ResponsivePanel";
import { CountdownBadge } from "@/components/game/shared/CountdownBadge";
import { RarityBadge } from "@/components/game/shared/RarityBadge";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/game/shared/StatusStates";
import {
  decodeGrowfiError,
  useGrowfiActions,
  useGrowfiShop,
} from "@/lib/solana/useGrowfiProgram";
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

export function SeedShopOverlay({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const growfiActions = useGrowfiActions();
  const [error, setError] = useState<string | null>(null);
  const { data, isLoading, refetch } = useGrowfiShop(open);

  const buyMutation = useMutation({
    mutationFn: (item: ShopItemView & { rotationId: number; seedId: number }) =>
      growfiActions.buySeed({
        rotationId: item.rotationId,
        seedId: item.seedId,
        quantity: 1,
      }),
    onSuccess: async () => {
      setError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["growfi-onchain-shop"] }),
        queryClient.invalidateQueries({ queryKey: ["growfi-onchain-state"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["garden"] }),
        queryClient.invalidateQueries({ queryKey: ["me"] }),
        queryClient.invalidateQueries({ queryKey: ["quests"] }),
        queryClient.invalidateQueries({ queryKey: ["tutorial"] }),
      ]);
    },
    onError: (err) => setError(decodeGrowfiError(err)),
  });

  const ensureRotationMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/shop/ensure-active-rotation", { method: "POST" }),
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({
        queryKey: ["growfi-onchain-shop"],
      });
      await refetch();
    },
    onError: (err) =>
      setError(
        err instanceof Error
          ? err.message
          : "No active shop rotation. Please create a shop rotation."
      ),
  });

  useEffect(() => {
    if (!open || !data?.rotation?.endsAt) {
      return;
    }
    const delay = new Date(data.rotation.endsAt).getTime() - Date.now() + 750;
    if (delay <= 0) {
      refetch();
      return;
    }
    const timer = window.setTimeout(() => {
      ensureRotationMutation.mutate();
    }, delay);
    return () => window.clearTimeout(timer);
  }, [data?.rotation?.endsAt, ensureRotationMutation, open, refetch]);

  return (
    <ResponsivePanel
      open={open}
      onOpenChange={onOpenChange}
      title="Seed Shop"
      description="Global rotating stock. Every farmer buys from the same limited rotation."
      wide
    >
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <CountdownBadge to={data?.rotation?.endsAt} label="Next refresh" />
        <Badge variant="outline" className="bg-white/80">
          $GROW balance updates after each purchase
        </Badge>
      </div>
      {error ? (
        <div className="mb-3">
          <ErrorState message={error} />
        </div>
      ) : null}
      {isLoading || !data ? (
        <LoadingState label="Loading seed shop" />
      ) : data.items.length === 0 ? (
        <div className="space-y-3">
          <EmptyState
            title="No active shop rotation"
            description="No active shop rotation was found. Devnet can create one automatically when an admin signer is configured."
          />
          <div className="rounded-md bg-muted p-3 text-xs font-semibold text-muted-foreground">
            Devnet setup: configure GROWFI_ADMIN_SECRET_KEY or
            TREASURY_WALLET_SECRET_KEY, then refresh. Manual fallback:
            npx tsx anchor/scripts/create-shop-rotation.ts
          </div>
          <Button
            disabled={ensureRotationMutation.isPending}
            onClick={() => ensureRotationMutation.mutate()}
          >
            <RefreshCw className="h-4 w-4" />
            Refresh/Create Devnet Shop Rotation
          </Button>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data.items.map((item) => {
            const remainingForUser = item.maxBuyPerUser - item.purchasedByUser;
            const stockPercent =
              item.stockTotal > 0
                ? (item.stockRemaining / item.stockTotal) * 100
                : 0;
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
                      <div className="text-xs font-semibold text-muted-foreground">
                        Price
                      </div>
                      <div className="text-xl font-bold">{item.price}</div>
                      {item.stockRemaining <= 0 ? (
                        <Badge variant="secondary">Sold Out</Badge>
                      ) : null}
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
                      <div className="text-xs font-semibold text-muted-foreground">
                        Limit
                      </div>
                      {remainingForUser}
                    </div>
                    <div className="rounded-md bg-muted p-2">
                      <div className="text-xs font-semibold text-muted-foreground">
                        Grow
                      </div>
                      {Math.round(item.seed.growTimeSeconds / 60)}m
                    </div>
                    <div className="rounded-md bg-muted p-2">
                      <div className="text-xs font-semibold text-muted-foreground">
                        Yield
                      </div>
                      {item.seed.minYield}-{item.seed.maxYield}
                    </div>
                  </div>
                  <Button
                    className="w-full"
                    disabled={
                      buyMutation.isPending ||
                      item.stockRemaining <= 0 ||
                      remainingForUser <= 0
                    }
                    onClick={() => buyMutation.mutate(item)}
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
