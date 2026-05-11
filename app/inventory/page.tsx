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
} from "@/components/inventory/InventoryCards";
import { apiFetch } from "@/lib/utils/fetcher";
import {
  decodeGrowfiError,
  mergeOnchainInventory,
  useGrowfiActions,
  useGrowfiOnchainState,
} from "@/lib/solana/useGrowfiProgram";
import type { InventoryResponse } from "@/types/game-data";

function InventoryContent() {
  const queryClient = useQueryClient();
  const growfiActions = useGrowfiActions();
  const onchain = useGrowfiOnchainState();
  const [error, setError] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => apiFetch<InventoryResponse>("/api/inventory"),
  });
  const inventory = mergeOnchainInventory(data, onchain.data);

  const sellMutation = useMutation({
    mutationFn: ({ fruit, quantity }: { fruit: FruitStackView; quantity: number }) => {
      const available = fruit.quantity - fruit.lockedQuantity;
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new Error("Enter at least 1 fruit.");
      }
      if (quantity > available) {
        throw new Error(`You only have ${available} available.`);
      }
      if (process.env.NODE_ENV === "development") {
        console.debug("[GrowFi] sell fruit mutation", {
          fruitStackId: fruit.id,
          fruit: fruit.fruit.name,
          mutation: fruit.mutation,
          ownedQty: fruit.quantity,
          lockedQty: fruit.lockedQuantity,
          amount: quantity,
        });
      }
      return growfiActions.sellFruit({
        fruit: fruit.fruit,
        mutation: fruit.mutation,
        quantity,
      });
    },
    onSuccess: async () => {
      setError(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["growfi-onchain-state"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["me"] }),
        queryClient.invalidateQueries({ queryKey: ["garden"] }),
        queryClient.invalidateQueries({ queryKey: ["quests"] }),
        queryClient.invalidateQueries({ queryKey: ["tutorial"] }),
      ]);
    },
    onError: (err) => setError(decodeGrowfiError(err)),
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

      {isLoading || !inventory ? (
        <Card className="font-bold text-leaf-800">Loading inventory...</Card>
      ) : (
        <div className="space-y-6">
          <section>
            <CardTitle className="mb-3">Seeds</CardTitle>
            <SeedCards seeds={inventory.seeds} />
          </section>
          <section>
            <div className="mb-3 flex items-center justify-between">
              <CardTitle>Fruit</CardTitle>
              <Button
                variant="secondary"
                size="sm"
                onClick={() =>
                  Promise.all([
                    queryClient.invalidateQueries({ queryKey: ["inventory"] }),
                    queryClient.invalidateQueries({
                      queryKey: ["growfi-onchain-state"],
                    }),
                  ])
                }
              >
                Refresh
              </Button>
            </div>
            <FruitCards
              fruits={inventory.fruits}
              onSell={(fruit, quantity) =>
                sellMutation.mutate({ fruit, quantity })
              }
              busyId={sellMutation.variables?.fruit.id ?? null}
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
