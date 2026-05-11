"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUpRight, Coins, Handshake, Sprout } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ItemCard } from "@/components/game/shared/ItemCard";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/game/shared/StatusStates";
import { ResponsivePanel } from "@/components/game/overlays/ResponsivePanel";
import { apiFetch } from "@/lib/utils/fetcher";
import { gameEventBus } from "@/lib/game/eventBus";
import {
  decodeGrowfiError,
  mergeOnchainInventory,
  useGrowfiActions,
  useGrowfiOnchainState,
} from "@/lib/solana/useGrowfiProgram";
import type { InventoryResponse } from "@/types/game-data";

export function InventoryOverlay({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const growfiActions = useGrowfiActions();
  const onchain = useGrowfiOnchainState(open);
  const [error, setError] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => apiFetch<InventoryResponse>("/api/inventory"),
    enabled: open,
  });
  const inventory = mergeOnchainInventory(data, onchain.data);

  const sellMutation = useMutation({
    mutationFn: (stack: InventoryResponse["fruits"][number]) => {
      const available = stack.quantity - stack.lockedQuantity;
      if (available < 1) {
        throw new Error(
          stack.lockedQuantity > 0
            ? "This fruit is locked in marketplace/trade."
            : "Enter at least 1 fruit."
        );
      }
      if (process.env.NODE_ENV === "development") {
        console.debug("[GrowFi] inventory overlay sell fruit", {
          fruitStackId: stack.id,
          fruit: stack.fruit.name,
          mutation: stack.mutation,
          ownedQty: stack.quantity,
          lockedQty: stack.lockedQuantity,
          amount: 1,
        });
      }
      return growfiActions.sellFruit({
        fruit: stack.fruit,
        mutation: stack.mutation,
        quantity: 1,
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
    <ResponsivePanel
      open={open}
      onOpenChange={onOpenChange}
      title="Inventory"
      description="Seeds, fruit, and tools available to your farmer."
      wide
    >
      {error ? (
        <div className="mb-3">
          <ErrorState message={error} />
        </div>
      ) : null}
      {isLoading || !inventory ? (
        <LoadingState label="Loading inventory" />
      ) : (
        <Tabs defaultValue="seeds">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="seeds">Seeds</TabsTrigger>
            <TabsTrigger value="fruits">Fruits</TabsTrigger>
            <TabsTrigger value="tools">Tools</TabsTrigger>
          </TabsList>
          <TabsContent value="seeds" className="mt-4">
            {inventory.seeds.length === 0 ? (
              <EmptyState
                title="No seeds yet"
                description="Walk to town and open the global seed shop."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {inventory.seeds.map((stack) => (
                  <ItemCard
                    key={stack.id}
                    icon={stack.seed.iconUrl}
                    name={stack.seed.name}
                    rarity={stack.seed.rarity}
                    quantity={stack.quantity}
                  >
                    <Button
                      variant="secondary"
                      className="w-full"
                      onClick={() => {
                        onOpenChange(false);
                        gameEventBus.emit("actionToast", {
                          title: "Stand near an empty plot",
                          description: "Then press E to plant this seed.",
                        });
                      }}
                    >
                      <Sprout className="h-4 w-4" />
                      Plant from Plot
                    </Button>
                  </ItemCard>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="fruits" className="mt-4">
            {inventory.fruits.length === 0 ? (
              <EmptyState
                title="No fruits yet"
                description="Harvest ready crops to fill this tab."
              />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {inventory.fruits.map((stack) => {
                  const available = stack.quantity - stack.lockedQuantity;
                  return (
                    <ItemCard
                      key={stack.id}
                      icon={stack.fruit.iconUrl}
                      name={stack.fruit.name}
                      rarity={stack.fruit.rarity}
                      mutation={stack.mutation}
                      quantity={stack.quantity}
                    >
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>{available} unlocked</span>
                        <Badge variant="outline">
                          base {stack.fruit.baseSellPrice || 0}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <Button
                          size="sm"
                          disabled={available <= 0 || sellMutation.isPending}
                          onClick={() => sellMutation.mutate(stack)}
                        >
                          <Coins className="h-4 w-4" />
                          Sell
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={available <= 0}
                          onClick={() => {
                            onOpenChange(false);
                            gameEventBus.emit("openOverlay", {
                              overlay: "marketplace",
                              payload: { create: true, fruit: stack },
                            });
                          }}
                        >
                          <ArrowUpRight className="h-4 w-4" />
                          List
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={available <= 0}
                          onClick={() => {
                            onOpenChange(false);
                            gameEventBus.emit("openOverlay", {
                              overlay: "trade",
                              payload: { fruit: stack },
                            });
                          }}
                        >
                          <Handshake className="h-4 w-4" />
                          Trade
                        </Button>
                      </div>
                    </ItemCard>
                  );
                })}
              </div>
            )}
          </TabsContent>
          <TabsContent value="tools" className="mt-4">
            <EmptyState
              title="No tools yet"
              description="Tool upgrades are reserved for the next farming expansion."
            />
          </TabsContent>
        </Tabs>
      )}
    </ResponsivePanel>
  );
}
