import type { Mutation, Rarity } from "@/types/game-data";

export type MarketplaceListingView = {
  id: string;
  address?: string;
  listingId?: string;
  sellerId: string;
  sellerWallet?: string;
  quantity: number;
  price: number;
  mutation: Mutation;
  status: "ACTIVE" | "SOLD" | "CANCELLED" | "EXPIRED";
  createdAt?: string;
  expiresAt: string;
  source?: "db" | "onchain";
  fruit: {
    id?: string;
    name: string;
    iconUrl: string;
    rarity: Rarity;
  };
  seller?: { id: string; username: string; avatarUrl?: string | null };
};

export type MarketplaceListingResponse = {
  listings: MarketplaceListingView[];
  myListings: MarketplaceListingView[];
};

function dedupeListings(listings: MarketplaceListingView[]) {
  const seen = new Set<string>();
  return listings.filter((listing) => {
    const key =
      listing.address ||
      (listing.source === "onchain" ? listing.id : `db:${listing.id}`);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function listingTime(listing: MarketplaceListingView) {
  return new Date(listing.createdAt || listing.expiresAt || 0).getTime();
}

export function mergeMarketplaceListings(
  dbListings: MarketplaceListingResponse | undefined,
  onchainListings:
    | {
        listings: MarketplaceListingView[];
        myListings: MarketplaceListingView[];
      }
    | null
    | undefined
) {
  const browse = dedupeListings([
    ...(dbListings?.listings || []).map((listing) => ({
      ...listing,
      source: listing.source || "db",
    })),
    ...(onchainListings?.listings || []),
  ]).sort((a, b) => listingTime(b) - listingTime(a));
  const myListings = dedupeListings([
    ...(dbListings?.myListings || []).map((listing) => ({
      ...listing,
      source: listing.source || "db",
    })),
    ...(onchainListings?.myListings || []),
  ]).sort((a, b) => listingTime(b) - listingTime(a));

  return { listings: browse, myListings };
}

export function isMineMarketplaceListing(
  listing: MarketplaceListingView,
  userId?: string,
  walletAddress?: string | null
) {
  return Boolean(
    (userId && listing.sellerId === userId) ||
      (walletAddress &&
        (listing.sellerWallet === walletAddress || listing.sellerId === walletAddress))
  );
}
