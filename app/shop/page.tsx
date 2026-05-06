"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";
import { AuthGate } from "@/components/layout/AuthGate";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Countdown } from "@/components/ui/countdown";
import { ShopItemCard, ShopItemView } from "@/components/shop/ShopItemCard";
import { apiFetch } from "@/lib/utils/fetcher";

type ShopResponse = {
  rotation: { id: string; startsAt: string; endsAt: string; status: string };
  items: ShopItemView[];
};

function ShopContent() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["shop"],
    queryFn: () => apiFetch<ShopResponse>("/api/shop/current"),
    refetchInterval: 15_000
  });

  const buyMutation = useMutation({
    mutationFn: (shopItemId: string) =>
      apiFetch("/api/shop/buy", {
        method: "POST",
        body: JSON.stringify({ shopItemId, quantity: 1 })
      }),
    onSuccess: async () => {
      setError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["shop"] }),
        queryClient.invalidateQueries({ queryKey: ["garden"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["me"] })
      ]);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Purchase failed")
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
          <div className="text-xs font-black uppercase text-leaf-700">Next rotation</div>
          <div className="text-2xl font-black">
            {data ? <Countdown to={data.rotation.endsAt} /> : "loading"}
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
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {data.items.map((item) => (
            <ShopItemCard
              key={item.id}
              item={item}
              onBuy={() => buyMutation.mutate(item.id)}
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
