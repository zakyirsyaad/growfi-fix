"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { ShoppingCart, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ConfirmActionDialog } from "@/components/game/shared/ConfirmActionDialog";
import { EmptyState, ErrorState, LoadingState } from "@/components/game/shared/StatusStates";
import { MutationBadge } from "@/components/game/shared/MutationBadge";
import { RarityBadge } from "@/components/game/shared/RarityBadge";
import {
  isMineMarketplaceListing,
  mergeMarketplaceListings,
  type MarketplaceListingResponse,
  type MarketplaceListingView,
} from "@/lib/marketplace/listingViews";
import { apiFetch } from "@/lib/utils/fetcher";
import type { InventoryResponse } from "@/types/game-data";
import {
  decodeGrowfiError,
  mergeOnchainInventory,
  useGrowfiActions,
  useGrowfiMarketplaceListings,
  useGrowfiOnchainState,
} from "@/lib/solana/useGrowfiProgram";

type MeResponse = { user: { id: string } };

export function MarketplaceDashboard() {
  const queryClient = useQueryClient();
  const { publicKey } = useWallet();
  const growfiActions = useGrowfiActions();
  const onchain = useGrowfiOnchainState();
  const onchainMarketplace = useGrowfiMarketplaceListings();
  const [selectedFruitId, setSelectedFruitId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(10);
  const [confirmListing, setConfirmListing] =
    useState<MarketplaceListingView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["marketplace"],
    queryFn: () => apiFetch<MarketplaceListingResponse>("/api/marketplace"),
    refetchInterval: 20_000
  });
  const { data: inventory } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => apiFetch<InventoryResponse>("/api/inventory")
  });
  const displayInventory = mergeOnchainInventory(inventory, onchain.data);
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<MeResponse>("/api/me")
  });
  const walletAddress = publicKey?.toBase58() || null;
  const marketplaceData = useMemo(
    () => mergeMarketplaceListings(data, onchainMarketplace.data),
    [data, onchainMarketplace.data]
  );

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["marketplace"] }),
      queryClient.invalidateQueries({ queryKey: ["growfi-onchain-marketplace"] }),
      queryClient.invalidateQueries({ queryKey: ["inventory"] }),
      queryClient.invalidateQueries({ queryKey: ["growfi-onchain-state"] }),
      queryClient.invalidateQueries({ queryKey: ["wallet-balances"] }),
      queryClient.invalidateQueries({ queryKey: ["me"] }),
      queryClient.invalidateQueries({ queryKey: ["activity"] }),
      queryClient.invalidateQueries({ queryKey: ["quests"] })
    ]);
  };

  const listMutation = useMutation({
    mutationFn: () => {
      const selectedFruit = displayInventory?.fruits.find(
        (fruit) => fruit.id === selectedFruitId
      );
      if (!selectedFruit) {
        throw new Error("Choose a fruit to list.");
      }
      const available = selectedFruit.quantity - selectedFruit.lockedQuantity;
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new Error("Enter at least 1 fruit.");
      }
      if (quantity > available) {
        throw new Error(`You only have ${available} available.`);
      }
      if (!Number.isFinite(price) || price <= 0) {
        throw new Error("Enter a price greater than 0.");
      }
      if (process.env.NODE_ENV === "development") {
        console.debug("[GrowFi] marketplace listing submit", {
          selectedFruitId,
          fruit: selectedFruit.fruit.name,
          mutation: selectedFruit.mutation,
          ownedQty: selectedFruit.quantity,
          lockedQty: selectedFruit.lockedQuantity,
          amount: quantity,
          price,
        });
      }
      if (selectedFruit.id.startsWith("onchain-fruit-")) {
        return growfiActions.createListing({
          fruit: selectedFruit.fruit,
          mutation: selectedFruit.mutation,
          quantity,
          price,
        });
      }
      return apiFetch("/api/marketplace/list", {
        method: "POST",
        body: JSON.stringify({ userFruitId: selectedFruitId, quantity, price })
      });
    },
    onSuccess: async (result) => {
      setError(null);
      setSelectedFruitId("");
      if (process.env.NODE_ENV === "development") {
        console.debug("[GrowFi] marketplace listing success", result);
      }
      toast.success("Marketplace listing created");
      await invalidate();
    },
    onError: (err) =>
      setError(err instanceof Error ? decodeGrowfiError(err) : "Listing failed")
  });
  const buyMutation = useMutation({
    mutationFn: (listing: MarketplaceListingView) => {
      if (listing.source === "onchain" && listing.address) {
        return growfiActions.buyListing({ address: listing.address });
      }
      return apiFetch("/api/marketplace/buy", {
        method: "POST",
        body: JSON.stringify({ listingId: listing.id })
      });
    },
    onSuccess: async () => {
      setConfirmListing(null);
      setError(null);
      toast.success("Marketplace listing bought");
      await invalidate();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Purchase failed")
  });
  const cancelMutation = useMutation({
    mutationFn: (listing: MarketplaceListingView) => {
      if (listing.source === "onchain" && listing.address) {
        return growfiActions.cancelListing({ address: listing.address });
      }
      return apiFetch("/api/marketplace/cancel", {
        method: "POST",
        body: JSON.stringify({ listingId: listing.id })
      });
    },
    onSuccess: async () => {
      setError(null);
      toast.success("Listing cancelled");
      await invalidate();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Cancel failed")
  });

  const activeMyListings = useMemo(
    () =>
      marketplaceData.myListings.filter((listing) => listing.status === "ACTIVE"),
    [marketplaceData.myListings]
  );
  const fruitOptions = useMemo(() => {
    const fruits = (displayInventory?.fruits || []).filter(
      (fruit) => fruit.quantity - fruit.lockedQuantity > 0
    );
    if (process.env.NODE_ENV === "development") {
      console.debug("[GrowFi] marketplace loaded fruit balances", displayInventory?.fruits || []);
      console.debug("[GrowFi] marketplace mapped fruit options", fruits);
    }
    return fruits;
  }, [displayInventory?.fruits]);
  const selectedFruit = fruitOptions.find((fruit) => fruit.id === selectedFruitId);
  const selectedAvailable = selectedFruit
    ? selectedFruit.quantity - selectedFruit.lockedQuantity
    : 0;
  const createInvalid =
    !selectedFruit ||
    !Number.isInteger(quantity) ||
    quantity < 1 ||
    quantity > selectedAvailable ||
    !Number.isFinite(price) ||
    price <= 0;

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") {
      return;
    }
    console.debug("[GrowFi] marketplace dashboard listings view", {
      browseListingsLoaded: marketplaceData.listings.length,
      myListingsLoaded: marketplaceData.myListings.length,
      connectedSellerWallet: walletAddress,
      filters: { browseStatus: "ACTIVE", myStatus: "ACTIVE" },
    });
  }, [
    marketplaceData.listings.length,
    marketplaceData.myListings.length,
    walletAddress,
  ]);

  if ((isLoading || onchainMarketplace.isLoading) && !data) {
    return <LoadingState label="Loading marketplace" />;
  }

  return (
    <>
      <div className="space-y-4">
        {error ? <ErrorState message={error} /> : null}
        <Tabs defaultValue="browse">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="browse">Browse</TabsTrigger>
            <TabsTrigger value="my">My Listings</TabsTrigger>
            <TabsTrigger value="create">Create Listing</TabsTrigger>
          </TabsList>
          <TabsContent value="browse" className="mt-4">
            {marketplaceData.listings.length === 0 ? (
              <EmptyState title="No listings yet" />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Fruit</TableHead>
                    <TableHead>Rarity</TableHead>
                    <TableHead>Mutation</TableHead>
                    <TableHead>Qty</TableHead>
                    <TableHead>Price</TableHead>
                    <TableHead>Seller</TableHead>
                    <TableHead className="text-right">Action</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {marketplaceData.listings.map((listing) => {
                    const mine = isMineMarketplaceListing(
                      listing,
                      me?.user.id,
                      walletAddress
                    );
                    return (
                      <TableRow key={listing.id}>
                        <TableCell className="font-semibold">{listing.fruit.iconUrl} {listing.fruit.name}</TableCell>
                        <TableCell><RarityBadge rarity={listing.fruit.rarity} /></TableCell>
                        <TableCell><MutationBadge mutation={listing.mutation} /></TableCell>
                        <TableCell>{listing.quantity}</TableCell>
                        <TableCell>{listing.price}</TableCell>
                        <TableCell>{listing.seller?.username || "You"}</TableCell>
                        <TableCell className="text-right">
                          {mine ? (
                            <Button size="sm" variant="secondary" disabled={cancelMutation.isPending} onClick={() => cancelMutation.mutate(listing)}>
                              <X className="h-4 w-4" />
                              Cancel
                            </Button>
                          ) : (
                            <Button size="sm" disabled={buyMutation.isPending} onClick={() => setConfirmListing(listing)}>
                              <ShoppingCart className="h-4 w-4" />
                              Buy
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </TabsContent>
          <TabsContent value="my" className="mt-4">
            {activeMyListings.length === 0 ? (
              <EmptyState title="No active listings" />
            ) : (
              <div className="grid gap-3 sm:grid-cols-2">
                {activeMyListings.map((listing) => (
                  <Card key={listing.id}>
                    <CardContent className="flex items-center justify-between gap-3 p-4">
                      <div>
                        <div className="font-semibold">{listing.fruit.iconUrl} {listing.fruit.name}</div>
                        <div className="mt-1 flex gap-1">
                          <RarityBadge rarity={listing.fruit.rarity} />
                          <MutationBadge mutation={listing.mutation} />
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold">{listing.price} $GROW</div>
                        <Button size="sm" variant="secondary" disabled={cancelMutation.isPending} onClick={() => cancelMutation.mutate(listing)}>Cancel</Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
          <TabsContent value="create" className="mt-4">
            <Card>
              <CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_140px_140px_auto]">
                <div>
                  <Label>Fruit</Label>
                  <Select value={selectedFruitId || "none"} onValueChange={(value) => setSelectedFruitId(value === "none" ? "" : value)}>
                    <SelectTrigger><SelectValue placeholder="Choose fruit" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Choose fruit</SelectItem>
                      {fruitOptions.map((fruit) => (
                        <SelectItem key={fruit.id} value={fruit.id}>
                          {fruit.fruit.iconUrl} {fruit.mutation.toLowerCase()} {fruit.fruit.name} x{fruit.quantity - fruit.lockedQuantity} · {fruit.fruit.rarity}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {!fruitOptions.length ? (
                    <div className="mt-2 text-xs font-semibold text-muted-foreground">
                      No fruits available to list. Harvest fruits first.
                    </div>
                  ) : null}
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input type="number" min={1} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
                  {selectedFruit ? (
                    <Button
                      className="mt-2 w-full"
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={() => setQuantity(selectedAvailable)}
                    >
                      Max {selectedAvailable}
                    </Button>
                  ) : null}
                </div>
                <div>
                  <Label>Price</Label>
                  <Input type="number" min={1} value={price} onChange={(event) => setPrice(Number(event.target.value))} />
                </div>
                <div className="flex items-end">
                  <Button disabled={createInvalid || listMutation.isPending} onClick={() => listMutation.mutate()}>
                    List Fruit
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
      <ConfirmActionDialog
        open={!!confirmListing}
        onOpenChange={(open) => !open && setConfirmListing(null)}
        title="Buy listing?"
        description={confirmListing ? `Buy ${confirmListing.quantity} ${confirmListing.fruit.name} for ${confirmListing.price} $GROW.` : ""}
        confirmLabel="Buy"
        busy={buyMutation.isPending}
        onConfirm={() => confirmListing && buyMutation.mutate(confirmListing)}
      />
    </>
  );
}
