"use client";

import Link from "next/link";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthGate } from "@/components/layout/AuthGate";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import type { InventoryResponse } from "@/types/game-data";

function InventoryContent() {
  const queryClient = useQueryClient();
  const growfiActions = useGrowfiActions();
  const onchain = useGrowfiOnchainState();
  const [error, setError] = useState<string | null>(null);
  const [listingFruit, setListingFruit] = useState<{
    fruit: FruitStackView;
    quantity: number;
  } | null>(null);
  const [listingPrice, setListingPrice] = useState<string>("");

  const { data, isLoading } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => apiFetch<InventoryResponse>("/api/inventory"),
  });
  const inventory = mergeOnchainInventory(data, onchain.data);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["growfi-onchain-state"] }),
      queryClient.invalidateQueries({ queryKey: ["inventory"] }),
      queryClient.invalidateQueries({ queryKey: ["me"] }),
      queryClient.invalidateQueries({ queryKey: ["garden"] }),
      queryClient.invalidateQueries({ queryKey: ["quests"] }),
      queryClient.invalidateQueries({ queryKey: ["tutorial"] }),
      queryClient.invalidateQueries({ queryKey: ["marketplace"] }),
      queryClient.invalidateQueries({
        queryKey: ["growfi-onchain-marketplace"],
      }),
    ]);
  };

  const sellMutation = useMutation({
    mutationFn: ({
      fruit,
      quantity,
    }: {
      fruit: FruitStackView;
      quantity: number;
    }) => {
      const available = fruit.quantity - fruit.lockedQuantity;
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new Error("Enter at least 1 fruit.");
      }
      if (quantity > available) {
        throw new Error(`You only have ${available} available.`);
      }
      return growfiActions.sellFruit({
        fruit: fruit.fruit,
        mutation: fruit.mutation,
        quantity,
      });
    },
    onSuccess: async () => {
      setError(null);
      toast.success("Fruit sold successfully!");
      await invalidate();
    },
    onError: (err) => setError(decodeGrowfiError(err)),
  });

  const listMutation = useMutation({
    mutationFn: async ({
      fruit,
      quantity,
      price,
    }: {
      fruit: FruitStackView;
      quantity: number;
      price: number;
    }) => {
      if (!price || price < 1)
        throw new Error("Price must be at least 1 $GROW");

      // Attempt onchain listing first if user has wallet connected, otherwise offchain
      // The growfiActions will handle fallback if needed, but for MVP we use apiFetch if offchain only.
      // We will try growfiActions.createListing directly.
      return growfiActions.createListing({
        fruit: fruit.fruit,
        mutation: fruit.mutation,
        quantity,
        price,
      });
    },
    onSuccess: async () => {
      toast.success("Listing created successfully!");
      setListingFruit(null);
      setListingPrice("");
      await invalidate();
    },
    onError: (err) => {
      toast.error(decodeGrowfiError(err));
    },
  });

  const handleListClick = (fruit: FruitStackView, quantity: number) => {
    setListingFruit({ fruit, quantity });
    setListingPrice("");
  };

  const submitListing = () => {
    if (!listingFruit) return;
    const price = Number(listingPrice);
    listMutation.mutate({
      fruit: listingFruit.fruit,
      quantity: listingFruit.quantity,
      price,
    });
  };

  return (
    <div className="mt-8">
      <PageHeader
        title="Inventory"
        eyebrow="Seeds and fruit"
        actions={
          <Link
            href="/marketplace"
            className="inline-flex h-10 items-center justify-center rounded-md bg-secondary px-4 py-2 text-sm font-bold text-secondary-foreground shadow-sm hover:bg-secondary/80 transition-colors"
          >
            Marketplace
          </Link>
        }
      />

      {error ? (
        <div className="mb-6 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm font-bold text-destructive">
          {error}
        </div>
      ) : null}

      {isLoading || !inventory ? (
        <div className="font-bold text-muted-foreground p-8 bg-card border border-border rounded-xl shadow-sm">
          Loading inventory...
        </div>
      ) : (
        <div className="space-y-10">
          <section>
            <h2 className="text-xl font-bold mb-4 text-foreground">Seeds</h2>
            <SeedCards seeds={inventory.seeds} />
          </section>
          <section>
            <div className="mb-4 flex items-center justify-between border-b border-border pb-2">
              <h2 className="text-xl font-bold text-foreground">Fruit</h2>
              <Button
                variant="outline"
                size="sm"
                className="font-bold"
                onClick={() => invalidate()}
              >
                Refresh
              </Button>
            </div>
            <FruitCards
              fruits={inventory.fruits}
              onSell={(fruit, quantity) =>
                sellMutation.mutate({ fruit, quantity })
              }
              onList={handleListClick}
              busyId={
                sellMutation.variables?.fruit.id ??
                listMutation.variables?.fruit.id ??
                null
              }
            />
          </section>
        </div>
      )}

      <Dialog
        open={!!listingFruit}
        onOpenChange={(open) => !open && setListingFruit(null)}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Marketplace Listing</DialogTitle>
            <DialogDescription>
              Set a price for {listingFruit?.quantity}x{" "}
              {listingFruit?.fruit.fruit.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex flex-col gap-2">
              <label
                htmlFor="price"
                className="text-sm font-bold text-foreground"
              >
                Price per bundle (Total $GROW)
              </label>
              <Input
                id="price"
                type="number"
                min="1"
                placeholder="e.g. 42"
                value={listingPrice}
                onChange={(e) => setListingPrice(e.target.value)}
                className="col-span-3 text-lg font-bold"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setListingFruit(null)}>
              Cancel
            </Button>
            <Button
              onClick={submitListing}
              disabled={listMutation.isPending || !listingPrice}
            >
              {listMutation.isPending ? "Listing..." : "Create Listing"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default function InventoryPage() {
  return (
    <AuthGate>
      <InventoryContent />
    </AuthGate>
  );
}
