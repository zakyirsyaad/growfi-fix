"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { AuthGate } from "@/components/layout/AuthGate";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Countdown } from "@/components/ui/countdown";
import { ShopItemCard, ShopItemView } from "@/components/shop/ShopItemCard";
import {
  decodeGrowfiError,
  useGrowfiActions,
  useGrowfiShop,
} from "@/lib/solana/useGrowfiProgram";

function ShopContent() {
  const queryClient = useQueryClient();
  const growfiActions = useGrowfiActions();
  const [error, setError] = useState<string | null>(null);
  const { data, isLoading, refetch } = useGrowfiShop();

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
        queryClient.invalidateQueries({ queryKey: ["garden"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["me"] }),
        queryClient.invalidateQueries({ queryKey: ["quests"] }),
        queryClient.invalidateQueries({ queryKey: ["tutorial"] }),
      ]);
    },
    onError: (err) => setError(decodeGrowfiError(err)),
  });

  return (
    <div className="mt-8">
      <PageHeader
        title="Seed Shop"
        eyebrow="Global rotating stock"
        actions={
          <Button
            variant="outline"
            onClick={() => refetch()}
            className="font-bold"
          >
            <RefreshCw size={16} className="mr-2" /> Refresh
          </Button>
        }
      />

      <Card className="mb-6 flex flex-wrap items-center justify-between gap-4 p-5 shadow-sm border-border bg-card">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
            Next rotation
          </div>
          <div className="text-3xl font-black text-foreground">
            {data?.rotation ? (
              <Countdown to={data.rotation.endsAt} />
            ) : (
              "No active rotation"
            )}
          </div>
        </div>
        <div className="text-sm font-bold text-muted-foreground bg-muted p-3 rounded-lg border border-border">
          Every farmer sees the same stock and global remaining quantities.
        </div>
      </Card>

      {error ? (
        <div className="mb-6 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm font-bold text-destructive">
          {error}
        </div>
      ) : null}

      {isLoading || !data ? (
        <div className="font-bold text-muted-foreground p-8 bg-card border border-border rounded-xl shadow-sm text-center">
          Loading shop...
        </div>
      ) : data.items.length === 0 ? (
        <Card className="space-y-4 p-8 text-center font-bold text-muted-foreground shadow-sm">
          <div className="text-lg text-foreground">
            No active shop rotation. Please create a shop rotation.
          </div>
          <div className="text-xs text-muted-foreground/80 bg-muted inline-block p-2 rounded">
            Devnet fallback: npx tsx anchor/scripts/create-shop-rotation.ts
          </div>
          <div className="pt-2">
            <Button
              variant="outline"
              onClick={() => refetch()}
              className="font-bold mx-auto"
            >
              <RefreshCw size={16} className="mr-2" /> Refresh / Create Devnet
              Rotation
            </Button>
          </div>
        </Card>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {data.items.map((item) => (
            <ShopItemCard
              key={item.id}
              item={item}
              onBuy={() => buyMutation.mutate(item)}
              disabled={buyMutation.isPending}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function ShopPage() {
  return (
    <AuthGate>
      <ShopContent />
    </AuthGate>
  );
}
