"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { Filter, ShoppingCart, X } from "lucide-react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { ResponsivePanel } from "@/components/game/overlays/ResponsivePanel";
import { ConfirmActionDialog } from "@/components/game/shared/ConfirmActionDialog";
import { CountdownBadge } from "@/components/game/shared/CountdownBadge";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/game/shared/StatusStates";
import { RarityBadge } from "@/components/game/shared/RarityBadge";
import { MutationBadge } from "@/components/game/shared/MutationBadge";
import { useMediaQuery } from "@/hooks/use-media-query";
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

type MeResponse = { user: { id: string; availableGrow: number } };

function ListingCard({
  listing,
  mine,
  busy,
  onBuy,
  onCancel,
}: {
  listing: MarketplaceListingView;
  mine?: boolean;
  busy?: boolean;
  onBuy?: () => void;
  onCancel?: () => void;
}) {
  return (
    <div className="pixel-card space-y-3 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="pixel-tile grid h-12 w-12 place-items-center text-2xl">
            {listing.fruit.iconUrl}
          </span>
          <div>
            <div className="font-bold text-[#f2fbf1]">{listing.fruit.name}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              <RarityBadge rarity={listing.fruit.rarity} />
              <MutationBadge mutation={listing.mutation} />
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="pixel-label">Price</div>
          <div className="text-xl font-bold text-[#f7d767]">
            {listing.price}
          </div>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-2 text-sm">
        <div className="pixel-card-sunken p-2">
          <div className="pixel-label">Qty</div>
          {listing.quantity}
        </div>
        <div className="pixel-card-sunken p-2">
          <div className="pixel-label">Seller</div>
          {listing.seller?.username || "You"}
        </div>
        <div className="pixel-card-sunken p-2">
          <div className="pixel-label">Ends</div>
          <CountdownBadge to={listing.expiresAt} />
        </div>
      </div>
      {mine ? (
        <button
          type="button"
          className="pixel-btn pixel-btn-ghost w-full px-4 py-2"
          disabled={busy}
          onClick={onCancel}
        >
          <X className="h-4 w-4" />
          CANCEL LISTING
        </button>
      ) : (
        <button
          type="button"
          className="pixel-btn pixel-btn-gold w-full px-4 py-2"
          disabled={busy}
          onClick={onBuy}
        >
          <ShoppingCart className="h-4 w-4" />
          BUY LISTING
        </button>
      )}
    </div>
  );
}

export function MarketplaceOverlay({
  open,
  onOpenChange,
  payload,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload?: unknown;
}) {
  const queryClient = useQueryClient();
  const { publicKey } = useWallet();
  const growfiActions = useGrowfiActions();
  const onchain = useGrowfiOnchainState(open);
  const onchainMarketplace = useGrowfiMarketplaceListings(open);
  const mobile = useMediaQuery("(max-width: 767px)");
  const [tab, setTab] = useState("browse");
  const [selectedFruitId, setSelectedFruitId] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(10);
  const [rarityFilter, setRarityFilter] = useState("ALL");
  const [mutationFilter, setMutationFilter] = useState("ALL");
  const [confirmListing, setConfirmListing] =
    useState<MarketplaceListingView | null>(null);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["marketplace"],
    queryFn: () => apiFetch<MarketplaceListingResponse>("/api/marketplace"),
    refetchInterval: 20_000,
    enabled: open,
  });
  const { data: inventory } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => apiFetch<InventoryResponse>("/api/inventory"),
    enabled: open,
  });
  const displayInventory = mergeOnchainInventory(inventory, onchain.data);
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<MeResponse>("/api/me"),
    enabled: open,
  });
  const walletAddress = publicKey?.toBase58() || null;
  const marketplaceData = useMemo(
    () => mergeMarketplaceListings(data, onchainMarketplace.data),
    [data, onchainMarketplace.data],
  );

  useEffect(() => {
    const value = payload as
      | {
          create?: boolean;
          fruit?: { id: string; fruit: { baseSellPrice?: number } };
        }
      | undefined;
    if (open && value?.create && value.fruit) {
      setTab("create");
      setSelectedFruitId(value.fruit.id);
      setPrice(Math.max(1, (value.fruit.fruit.baseSellPrice || 5) * 2));
    }
  }, [open, payload]);

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["marketplace"] }),
      queryClient.invalidateQueries({
        queryKey: ["growfi-onchain-marketplace"],
      }),
      queryClient.invalidateQueries({ queryKey: ["inventory"] }),
      queryClient.invalidateQueries({ queryKey: ["growfi-onchain-state"] }),
      queryClient.invalidateQueries({ queryKey: ["wallet-balances"] }),
      queryClient.invalidateQueries({ queryKey: ["me"] }),
      queryClient.invalidateQueries({ queryKey: ["activity"] }),
      queryClient.invalidateQueries({ queryKey: ["quests"] }),
    ]);
  };

  const listMutation = useMutation({
    mutationFn: () => {
      const selectedFruit = displayInventory?.fruits.find(
        (fruit) => fruit.id === selectedFruitId,
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
        console.debug("[GrowFi] marketplace overlay listing submit", {
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
        body: JSON.stringify({ userFruitId: selectedFruitId, quantity, price }),
      });
    },
    onSuccess: async (result) => {
      setError(null);
      setSelectedFruitId("");
      if (process.env.NODE_ENV === "development") {
        console.debug("[GrowFi] marketplace overlay listing success", result);
      }
      toast.success("Marketplace listing created", {
        description: `${quantity} fruit listed for ${price} $GROW.`,
      });
      await invalidate();
      setTab("my");
    },
    onError: (err) =>
      setError(
        err instanceof Error ? decodeGrowfiError(err) : "Listing failed",
      ),
  });

  const buyMutation = useMutation({
    mutationFn: (listing: MarketplaceListingView) => {
      if (listing.source === "onchain" && listing.address) {
        return growfiActions.buyListing({ address: listing.address });
      }
      return apiFetch("/api/marketplace/buy", {
        method: "POST",
        body: JSON.stringify({ listingId: listing.id }),
      });
    },
    onSuccess: async () => {
      setError(null);
      setConfirmListing(null);
      toast.success("Marketplace listing bought");
      await invalidate();
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : "Purchase failed"),
  });

  const cancelMutation = useMutation({
    mutationFn: (listing: MarketplaceListingView) => {
      if (listing.source === "onchain" && listing.address) {
        return growfiActions.cancelListing({ address: listing.address });
      }
      return apiFetch("/api/marketplace/cancel", {
        method: "POST",
        body: JSON.stringify({ listingId: listing.id }),
      });
    },
    onSuccess: async () => {
      setError(null);
      toast.success("Listing cancelled", {
        description: "Locked fruit returned to inventory.",
      });
      await invalidate();
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : "Cancel failed"),
  });

  useEffect(() => {
    if (!open || process.env.NODE_ENV !== "development") {
      return;
    }
    console.debug("[GrowFi] marketplace overlay listings view", {
      browseListingsLoaded: marketplaceData.listings.length,
      myListingsLoaded: marketplaceData.myListings.length,
      connectedSellerWallet: walletAddress,
      filters: { rarityFilter, mutationFilter },
    });
  }, [
    open,
    marketplaceData.listings.length,
    marketplaceData.myListings.length,
    walletAddress,
    rarityFilter,
    mutationFilter,
  ]);

  const filteredListings = useMemo(() => {
    return marketplaceData.listings.filter((listing) => {
      if (rarityFilter !== "ALL" && listing.fruit.rarity !== rarityFilter) {
        return false;
      }
      if (mutationFilter !== "ALL" && listing.mutation !== mutationFilter) {
        return false;
      }
      return true;
    });
  }, [marketplaceData.listings, rarityFilter, mutationFilter]);

  const fruitOptions = useMemo(() => {
    const fruits = (displayInventory?.fruits || []).filter(
      (fruit) => fruit.quantity - fruit.lockedQuantity > 0,
    );
    if (process.env.NODE_ENV === "development") {
      console.debug(
        "[GrowFi] marketplace overlay loaded fruit balances",
        displayInventory?.fruits || [],
      );
      console.debug(
        "[GrowFi] marketplace overlay mapped fruit options",
        fruits,
      );
    }
    return fruits;
  }, [displayInventory?.fruits]);
  const selectedFruit = fruitOptions.find(
    (fruit) => fruit.id === selectedFruitId,
  );
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

  return (
    <>
      <ResponsivePanel
        open={open}
        onOpenChange={onOpenChange}
        title="Marketplace"
        description="Browse, list, buy, and cancel fruit listings."
        wide
      >
        {error ? (
          <div className="mb-3">
            <ErrorState message={error} />
          </div>
        ) : null}
        {(isLoading || onchainMarketplace.isLoading) && !data ? (
          <LoadingState label="Loading marketplace" />
        ) : (
          <Tabs value={tab} onValueChange={setTab}>
            <TabsList className="grid w-full grid-cols-3 bg-[#0a0f0d] border-2 border-[#153d21]">
              <TabsTrigger
                value="browse"
                className="data-[state=active]:bg-[#3d9f4b] data-[state=active]:text-[#0a0f0d] text-[#91d985] font-sans"
              >
                Browse
              </TabsTrigger>
              <TabsTrigger
                value="my"
                className="data-[state=active]:bg-[#3d9f4b] data-[state=active]:text-[#0a0f0d] text-[#91d985] font-sans"
              >
                My Listings
              </TabsTrigger>
              <TabsTrigger
                value="create"
                className="data-[state=active]:bg-[#3d9f4b] data-[state=active]:text-[#0a0f0d] text-[#91d985] font-sans"
              >
                Create
              </TabsTrigger>
            </TabsList>
            <TabsContent value="browse" className="mt-4 space-y-3">
              <div className="pixel-card grid gap-3 p-3 sm:grid-cols-[1fr_1fr_auto]">
                <div>
                  <Label>Rarity</Label>
                  <Select value={rarityFilter} onValueChange={setRarityFilter}>
                    <SelectTrigger className="pixel-input px-3 py-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        "ALL",
                        "COMMON",
                        "UNCOMMON",
                        "RARE",
                        "EPIC",
                        "LEGENDARY",
                        "MYTHIC",
                      ].map((value) => (
                        <SelectItem key={value} value={value}>
                          {value.toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Mutation</Label>
                  <Select
                    value={mutationFilter}
                    onValueChange={setMutationFilter}
                  >
                    <SelectTrigger className="pixel-input px-3 py-2">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[
                        "ALL",
                        "NORMAL",
                        "BIG",
                        "SWEET",
                        "GOLDEN",
                        "CRYSTAL",
                        "RAINBOW",
                      ].map((value) => (
                        <SelectItem key={value} value={value}>
                          {value.toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    className="pixel-btn pixel-btn-ghost w-full px-4 py-2"
                  >
                    <Filter className="h-4 w-4" />
                    FILTERS
                  </button>
                </div>
              </div>
              {filteredListings.length === 0 ? (
                <EmptyState
                  title="No listings yet"
                  description="Check back after farmers harvest and list fruit."
                />
              ) : mobile ? (
                <div className="grid gap-3">
                  {filteredListings.map((listing) => (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      mine={isMineMarketplaceListing(
                        listing,
                        me?.user.id,
                        walletAddress,
                      )}
                      busy={buyMutation.isPending || cancelMutation.isPending}
                      onBuy={() => setConfirmListing(listing)}
                      onCancel={() => cancelMutation.mutate(listing)}
                    />
                  ))}
                </div>
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
                    {filteredListings.map((listing) => {
                      const mine = isMineMarketplaceListing(
                        listing,
                        me?.user.id,
                        walletAddress,
                      );
                      return (
                        <TableRow key={listing.id}>
                          <TableCell className="font-semibold">
                            {listing.fruit.iconUrl} {listing.fruit.name}
                          </TableCell>
                          <TableCell>
                            <RarityBadge rarity={listing.fruit.rarity} />
                          </TableCell>
                          <TableCell>
                            <MutationBadge mutation={listing.mutation} />
                          </TableCell>
                          <TableCell>{listing.quantity}</TableCell>
                          <TableCell>{listing.price}</TableCell>
                          <TableCell>
                            {listing.seller?.username || "You"}
                          </TableCell>
                          <TableCell className="text-right">
                            {mine ? (
                              <button
                                type="button"
                                className="pixel-btn pixel-btn-ghost px-3 py-2"
                                onClick={() => cancelMutation.mutate(listing)}
                                disabled={cancelMutation.isPending}
                              >
                                CANCEL
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="pixel-btn pixel-btn-gold px-3 py-2"
                                onClick={() => setConfirmListing(listing)}
                                disabled={buyMutation.isPending}
                              >
                                BUY
                              </button>
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
              {marketplaceData.myListings.length === 0 ? (
                <EmptyState title="No listings yet" />
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {marketplaceData.myListings.map((listing) => (
                    <ListingCard
                      key={listing.id}
                      listing={listing}
                      mine
                      busy={cancelMutation.isPending}
                      onCancel={() => cancelMutation.mutate(listing)}
                    />
                  ))}
                </div>
              )}
            </TabsContent>
            <TabsContent value="create" className="mt-4">
              <div className="pixel-card space-y-4 p-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="sm:col-span-3">
                    <Label>Fruit</Label>
                    <Select
                      value={selectedFruitId || "none"}
                      onValueChange={(value) =>
                        setSelectedFruitId(value === "none" ? "" : value)
                      }
                    >
                      <SelectTrigger className="pixel-input px-3 py-2">
                        <SelectValue placeholder="Choose fruit" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Choose fruit</SelectItem>
                        {fruitOptions.map((stack) => (
                          <SelectItem key={stack.id} value={stack.id}>
                            {stack.fruit.iconUrl}{" "}
                            {stack.mutation.toLowerCase()} {stack.fruit.name}{" "}
                            x{stack.quantity - stack.lockedQuantity} ·{" "}
                            {stack.fruit.rarity}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {!fruitOptions.length ? (
                      <div className="mt-2 text-xs font-semibold text-[#5e8c52]">
                        No fruits available to list. Harvest fruits first.
                      </div>
                    ) : null}
                  </div>
                  <div>
                    <Label>Quantity</Label>
                    <Input
                      type="number"
                      min={1}
                      value={quantity}
                      className="pixel-input px-3 py-2"
                      onChange={(event) =>
                        setQuantity(Number(event.target.value))
                      }
                    />
                    {selectedFruit ? (
                      <button
                        className="pixel-btn pixel-btn-ghost mt-2 w-full px-3 py-2"
                        type="button"
                        onClick={() => setQuantity(selectedAvailable)}
                      >
                        MAX {selectedAvailable}
                      </button>
                    ) : null}
                  </div>
                  <div>
                    <Label>Price</Label>
                    <Input
                      type="number"
                      min={1}
                      value={price}
                      className="pixel-input px-3 py-2"
                      onChange={(event) => setPrice(Number(event.target.value))}
                    />
                  </div>
                  <div className="flex items-end">
                    <button
                      type="button"
                      className="pixel-btn pixel-btn-gold w-full px-4 py-2"
                      disabled={createInvalid || listMutation.isPending}
                      onClick={() => listMutation.mutate()}
                    >
                      CREATE LISTING
                    </button>
                  </div>
                </div>
              </div>
            </TabsContent>
          </Tabs>
        )}
      </ResponsivePanel>
      <ConfirmActionDialog
        open={!!confirmListing}
        onOpenChange={(nextOpen) => !nextOpen && setConfirmListing(null)}
        title="Buy listing?"
        description={
          confirmListing
            ? `Buy ${confirmListing.quantity} ${confirmListing.fruit.name} for ${confirmListing.price} $GROW.`
            : ""
        }
        confirmLabel="Buy"
        busy={buyMutation.isPending}
        onConfirm={() => confirmListing && buyMutation.mutate(confirmListing)}
      />
    </>
  );
}
