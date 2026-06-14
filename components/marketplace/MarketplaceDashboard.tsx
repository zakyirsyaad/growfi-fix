"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";
import { ConfirmActionDialog } from "@/components/game/shared/ConfirmActionDialog";
import {
  isMineMarketplaceListing,
  mergeMarketplaceListings,
  type MarketplaceListingResponse,
  type MarketplaceListingView,
} from "@/lib/marketplace/listingViews";
import { apiFetch } from "@/lib/utils/fetcher";

import {
  useGrowfiActions,
  useGrowfiMarketplaceListings,
} from "@/lib/solana/useGrowfiProgram";
import { Search, TrendingUp, Store, Activity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { RarityBadge } from "@/components/game/shared/RarityBadge";
import { MutationBadge } from "@/components/game/shared/MutationBadge";

type MeResponse = { user: { id: string } };

export function MarketplaceDashboard() {
  const queryClient = useQueryClient();
  const { publicKey } = useWallet();
  const growfiActions = useGrowfiActions();
  const onchainMarketplace = useGrowfiMarketplaceListings();
  const [confirmListing, setConfirmListing] =
    useState<MarketplaceListingView | null>(null);

  // Search & Filter State
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRarities, setSelectedRarities] = useState<string[]>([]);

  const { data } = useQuery({
    queryKey: ["marketplace"],
    queryFn: () => apiFetch<MarketplaceListingResponse>("/api/marketplace"),
    refetchInterval: 20_000,
  });
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<MeResponse>("/api/me"),
  });

  const walletAddress = publicKey?.toBase58() || null;
  const marketplaceData = useMemo(
    () => mergeMarketplaceListings(data, onchainMarketplace.data),
    [data, onchainMarketplace.data],
  );

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
      setConfirmListing(null);
      toast.success("Marketplace listing bought");
      await invalidate();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Purchase failed"),
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
      toast.success("Listing cancelled");
      await invalidate();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Cancel failed"),
  });

  // Calculate stats
  const itemsListed = marketplaceData.listings.length;
  const floorPrice =
    itemsListed > 0
      ? Math.min(...marketplaceData.listings.map((l) => l.price))
      : 0;

  // Filter listings
  const filteredListings = useMemo(() => {
    return marketplaceData.listings.filter((listing) => {
      const matchSearch = listing.fruit.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());
      const matchRarity =
        selectedRarities.length === 0 ||
        selectedRarities.includes(listing.fruit.rarity);
      return matchSearch && matchRarity;
    });
  }, [marketplaceData.listings, searchQuery, selectedRarities]);

  const toggleRarity = (rarity: string) => {
    setSelectedRarities((prev) =>
      prev.includes(rarity)
        ? prev.filter((r) => r !== rarity)
        : [...prev, rarity],
    );
  };

  return (
    <div className="flex flex-col md:flex-row gap-6 mt-8">
      {/* Sidebar (Filters) */}
      <aside className="w-full md:w-[260px] flex-shrink-0">
        <Card className="p-6">
          <h2 className="text-xl font-bold mb-6 text-foreground">
            Filter Marketplace
          </h2>
          <div className="space-y-6">
            {/* Rarity */}
            <div>
              <h3 className="text-xs font-bold text-muted-foreground mb-4 uppercase tracking-wider">
                Rarity
              </h3>
              <div className="space-y-3">
                {[
                  "COMMON",
                  "UNCOMMON",
                  "RARE",
                  "EPIC",
                  "LEGENDARY",
                  "MYTHIC",
                ].map((rarity) => (
                  <Label
                    key={rarity}
                    className="flex items-center gap-3 cursor-pointer group"
                  >
                    <Checkbox
                      checked={selectedRarities.includes(rarity)}
                      onCheckedChange={() => toggleRarity(rarity)}
                    />
                    <span className="text-sm font-medium group-hover:text-primary transition-colors text-foreground capitalize">
                      {rarity.toLowerCase()}
                    </span>
                  </Label>
                ))}
              </div>
            </div>
          </div>
        </Card>
      </aside>

      {/* Main Content */}
      <div className="flex-1 space-y-8">
        {/* Bento Grid Header & Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Main Header / Search - spans 2 cols */}
          <Card className="md:col-span-2 p-8 flex flex-col justify-center relative overflow-hidden">
            <h1 className="text-4xl lg:text-5xl text-foreground font-black mb-4">
              Global <span className="text-primary">Market</span>
            </h1>
            <p className="text-muted-foreground mb-6 max-w-md text-lg">
              Trade rare genetics, farm tools, and harvested crops with zero
              slippage.
            </p>
            <div className="relative w-full max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5 z-10" />
              <Input
                className="w-full pl-12 pr-4 py-4 h-auto rounded-xl"
                placeholder="Search for seeds or crops..."
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </Card>

          {/* Total Volume Stats */}
          <Card className="p-6 flex flex-col justify-between relative">
            <div className="absolute top-4 right-4 bg-muted text-muted-foreground text-[10px] font-bold px-2 py-1 rounded-md uppercase tracking-wider">
              Demo Data
            </div>
            <div className="w-12 h-12 bg-primary/10 text-primary flex items-center justify-center rounded-xl mb-4">
              <Activity className="w-6 h-6" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold mb-1">
                Total Volume
              </p>
              <p className="text-3xl font-black text-foreground">1.2M</p>
              <p className="text-primary font-bold mt-1">+$GROW</p>
            </div>
          </Card>

          {/* Floor & Items Listed Stats */}
          <div className="grid grid-rows-2 gap-6 h-full">
            <Card className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 bg-secondary text-secondary-foreground flex items-center justify-center rounded-lg">
                <TrendingUp className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">
                  Floor Price
                </p>
                <p className="text-xl font-bold text-foreground">
                  {floorPrice > 0 ? `${floorPrice} $GROW` : "--"}
                </p>
              </div>
            </Card>
            <Card className="p-5 flex items-center gap-4">
              <div className="w-10 h-10 bg-accent text-accent-foreground flex items-center justify-center rounded-lg">
                <Store className="w-5 h-5" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">
                  Items Listed
                </p>
                <p className="text-xl font-bold text-foreground">
                  {itemsListed}
                </p>
              </div>
            </Card>
          </div>
        </div>

        {/* Listings Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredListings.map((listing) => {
            const mine = isMineMarketplaceListing(
              listing,
              me?.user.id,
              walletAddress,
            );
            return (
              <Card
                key={listing.id}
                className="overflow-hidden flex flex-col hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-300"
              >
                <div className="aspect-square bg-muted relative overflow-hidden flex items-center justify-center text-7xl">
                  <div>{listing.fruit.iconUrl || "🌱"}</div>
                  <div className="absolute top-4 right-4">
                    <RarityBadge rarity={listing.fruit.rarity} />
                  </div>
                </div>
                <div className="p-6 space-y-4 flex flex-col flex-1">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      {listing.mutation !== "NORMAL" ? (
                        <MutationBadge mutation={listing.mutation} />
                      ) : null}
                    </div>
                    <h3 className="text-2xl font-bold mb-1 text-foreground">
                      {listing.fruit.name}
                    </h3>
                    <p className="text-sm text-muted-foreground flex items-center gap-2 font-medium">
                      <span className="bg-muted border border-border px-2 py-0.5 rounded text-xs">
                        x{listing.quantity}
                      </span>
                      <span>
                        •{" "}
                        {listing.seller?.username || (mine ? "You" : "Unknown")}
                      </span>
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-border mt-auto">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wider font-bold">
                        Price
                      </p>
                      <p className="text-xl font-black text-primary">
                        {listing.price} $GROW
                      </p>
                    </div>
                    {mine ? (
                      <Button
                        variant="secondary"
                        disabled={cancelMutation.isPending}
                        onClick={() => cancelMutation.mutate(listing)}
                        className="px-6 py-2.5 rounded-xl font-bold h-auto"
                      >
                        Cancel
                      </Button>
                    ) : (
                      <Button
                        variant="default"
                        disabled={buyMutation.isPending}
                        onClick={() => setConfirmListing(listing)}
                        className="px-6 py-2.5 rounded-xl font-bold h-auto"
                      >
                        Buy
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {filteredListings.length === 0 && (
          <div className="py-12 text-center text-muted-foreground">
            No listings found matching your search and filters.
          </div>
        )}

        <ConfirmActionDialog
          open={!!confirmListing}
          onOpenChange={(open) => !open && setConfirmListing(null)}
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
      </div>
    </div>
  );
}
