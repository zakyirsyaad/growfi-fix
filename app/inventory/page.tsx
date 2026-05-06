"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthGate } from "@/components/layout/AuthGate";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import {
  FruitCards,
  FruitStackView,
  SeedCards,
  SeedStackView
} from "@/components/inventory/InventoryCards";
import { apiFetch } from "@/lib/utils/fetcher";

type InventoryResponse = {
  seeds: SeedStackView[];
  fruits: FruitStackView[];
};

function InventoryContent() {
  const queryClient = useQueryClient();
  const [error, setError] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => apiFetch<InventoryResponse>("/api/inventory")
  });

  const sellMutation = useMutation({
    mutationFn: (userFruitId: string) =>
      apiFetch("/api/fruits/sell", {
        method: "POST",
        body: JSON.stringify({ userFruitId, quantity: 1 })
      }),
    onSuccess: async () => {
      setError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["me"] })
      ]);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Sale failed")
  });

  return (
    <>
      <PageHeader
        title="Inventory"
        eyebrow="Seeds and fruit"
        actions={
          <Link
            href="/marketplace"
            className="inline-flex h-10 items-center rounded-lg bg-white/85 px-4 text-sm font-black text-leaf-900 ring-1 ring-leaf-200"
          >
            Marketplace
          </Link>
        }
      />

      {error ? (
        <div className="mb-4 rounded-lg bg-berry-100 px-4 py-3 text-sm font-bold text-berry-700">
          {error}
        </div>
      ) : null}

      {isLoading || !data ? (
        <Card className="font-bold text-leaf-800">Loading inventory...</Card>
      ) : (
        <div className="space-y-6">
          <section>
            <CardTitle className="mb-3">Seeds</CardTitle>
            <SeedCards seeds={data.seeds} />
          </section>
          <section>
            <div className="mb-3 flex items-center justify-between">
              <CardTitle>Fruit</CardTitle>
              <Button variant="secondary" size="sm" onClick={() => queryClient.invalidateQueries({ queryKey: ["inventory"] })}>
                Refresh
              </Button>
            </div>
            <FruitCards
              fruits={data.fruits}
              onSell={(fruit) => sellMutation.mutate(fruit.id)}
              busyId={sellMutation.variables as string | null}
            />
          </section>
        </div>
      )}
    </>
  );
}

export default function InventoryPage() {
  return (
    <AuthGate>
      <InventoryContent />
    </AuthGate>
  );
}
