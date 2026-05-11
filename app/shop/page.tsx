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
    <>
      <PageHeader
        title="Seed Shop"
        eyebrow="Global rotating stock"
        actions={
          <Button variant="secondary" onClick={() => refetch()}>
            <RefreshCw size={16} /> Refresh
          </Button>
        }
      />

      <Card className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-xs font-black uppercase text-leaf-700">
            Next rotation
          </div>
          <div className="text-2xl font-black">
            {data?.rotation ? (
              <Countdown to={data.rotation.endsAt} />
            ) : (
              "no active rotation"
            )}
          </div>
        </div>
        <div className="text-sm font-bold text-leaf-800">
          Every farmer sees the same stock and global remaining quantities.
        </div>
      </Card>

      {error ? (
        <div className="mb-4 rounded-lg bg-berry-100 px-4 py-3 text-sm font-bold text-berry-700">
          {error}
        </div>
      ) : null}

      {isLoading || !data ? (
        <Card className="font-bold text-leaf-800">Loading shop...</Card>
      ) : data.items.length === 0 ? (
        <Card className="space-y-3 font-bold text-leaf-800">
          <div>No active shop rotation. Please create a shop rotation.</div>
          <div className="text-xs text-muted-foreground">
            Devnet fallback: npx tsx anchor/scripts/create-shop-rotation.ts
          </div>
          <Button variant="secondary" onClick={() => refetch()}>
            <RefreshCw size={16} /> Refresh/Create Devnet Rotation
          </Button>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
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
    </>
  );
}

export default function ShopPage() {
  return (
    <AuthGate>
      <ShopContent />
    </AuthGate>
  );
}
