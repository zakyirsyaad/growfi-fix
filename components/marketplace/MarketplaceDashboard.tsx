"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { apiFetch } from "@/lib/utils/fetcher";
import type { InventoryResponse, Mutation, Rarity } from "@/types/game-data";

type ListingView = {
  id: string;
  sellerId: string;
  quantity: number;
  price: number;
  mutation: Mutation;
  status: "ACTIVE" | "SOLD" | "CANCELLED" | "EXPIRED";
  expiresAt: string;
  fruit: { name: string; iconUrl: string; rarity: Rarity };
  seller?: { id: string; username: string; avatarUrl?: string | null };
};

type MarketplaceResponse = {
  listings: ListingView[];
  myListings: ListingView[];
};

type MeResponse = { user: { id: string } };

export function MarketplaceDashboard() {
  const queryClient = useQueryClient();
  const [selectedFruitId, setSelectedFruitId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(10);
  const [confirmListing, setConfirmListing] = useState<ListingView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["marketplace"],
    queryFn: () => apiFetch<MarketplaceResponse>("/api/marketplace"),
    refetchInterval: 20_000
  });
  const { data: inventory } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => apiFetch<InventoryResponse>("/api/inventory")
  });
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<MeResponse>("/api/me")
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["marketplace"] }),
      queryClient.invalidateQueries({ queryKey: ["inventory"] }),
      queryClient.invalidateQueries({ queryKey: ["me"] })
    ]);
  };

  const listMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/marketplace/list", {
        method: "POST",
        body: JSON.stringify({ userFruitId: selectedFruitId, quantity, price })
      }),
    onSuccess: async () => {
      setError(null);
      setSelectedFruitId("");
      toast.success("Listing created");
      await invalidate();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Listing failed")
  });
  const buyMutation = useMutation({
    mutationFn: (listingId: string) =>
      apiFetch("/api/marketplace/buy", {
        method: "POST",
        body: JSON.stringify({ listingId })
      }),
    onSuccess: async () => {
      setConfirmListing(null);
      setError(null);
      toast.success("Listing bought");
      await invalidate();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Purchase failed")
  });
  const cancelMutation = useMutation({
    mutationFn: (listingId: string) =>
      apiFetch("/api/marketplace/cancel", {
        method: "POST",
        body: JSON.stringify({ listingId })
      }),
    onSuccess: async () => {
      setError(null);
      toast.success("Listing cancelled");
      await invalidate();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Cancel failed")
  });

  const activeMyListings = useMemo(
    () => data?.myListings.filter((listing) => listing.status === "ACTIVE") || [],
    [data]
  );

  if (isLoading || !data) {
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
            {data.listings.length === 0 ? (
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
                  {data.listings.map((listing) => {
                    const mine = listing.sellerId === me?.user.id;
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
                            <Button size="sm" variant="secondary" disabled={cancelMutation.isPending} onClick={() => cancelMutation.mutate(listing.id)}>
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
                        <Button size="sm" variant="secondary" disabled={cancelMutation.isPending} onClick={() => cancelMutation.mutate(listing.id)}>Cancel</Button>
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
                      {(inventory?.fruits || []).map((fruit) => (
                        <SelectItem key={fruit.id} value={fruit.id}>
                          {fruit.fruit.iconUrl} {fruit.mutation.toLowerCase()} {fruit.fruit.name} x{fruit.quantity - fruit.lockedQuantity}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Quantity</Label>
                  <Input type="number" min={1} value={quantity} onChange={(event) => setQuantity(Number(event.target.value))} />
                </div>
                <div>
                  <Label>Price</Label>
                  <Input type="number" min={1} value={price} onChange={(event) => setPrice(Number(event.target.value))} />
                </div>
                <div className="flex items-end">
                  <Button disabled={!selectedFruitId || listMutation.isPending} onClick={() => listMutation.mutate()}>
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
        onConfirm={() => confirmListing && buyMutation.mutate(confirmListing.id)}
      />
    </>
  );
}
