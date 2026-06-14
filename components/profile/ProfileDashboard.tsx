"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, RefreshCw } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  EmptyState,
  LoadingState,
} from "@/components/game/shared/StatusStates";
import { StaminaBar } from "@/components/game/shared/StaminaBar";
import {
  mergeMarketplaceListings,
  type MarketplaceListingResponse,
} from "@/lib/marketplace/listingViews";
import {
  useGrowfiMarketplaceListings,
  useGrowfiOnchainState,
} from "@/lib/solana/useGrowfiProgram";
import {
  clientGrowMintFromConfig,
  clientTreasuryVaultFromConfig,
  useWalletBalances,
} from "@/lib/solana/useWalletBalances";
import { getGrowfiCoreProgramId } from "@/lib/solana/growfiCore";
import { apiFetch } from "@/lib/utils/fetcher";

type MeResponse = {
  user: {
    id: string;
    username: string;
    avatarUrl?: string | null;
    walletAddress?: string | null;
    growBalance: number;
    lockedGrowBalance: number;
    availableGrow: number;
    stamina: number;
    maxStamina: number;
    gardenLevel: number;
    totalHarvests: number;
    totalTrades: number;
    marketplaceSales: number;
    createdAt: string;
  };
  stats: {
    activeListings: number;
    activeTrades: number;
    transactionCount: number;
  };
};

type ActivityResponse = {
  logs: Array<{ id: string; type: string; message: string; createdAt: string }>;
};

type FarmLike = {
  level?: number;
  width?: number;
  height?: number;
  plotCount?: number;
};

type PlayerLike = {
  gardenLevel?: number;
  totalHarvests?: unknown;
  totalTrades?: unknown;
};

function asNumber(value: unknown) {
  if (typeof value === "number") {
    return value;
  }
  if (value && typeof value === "object" && "toNumber" in value) {
    return Number((value as { toNumber: () => number }).toNumber());
  }
  return Number(value || 0);
}

function explorerAccountUrl(address?: string | null) {
  return address
    ? `https://explorer.solana.com/address/${address}?cluster=devnet`
    : null;
}

function StatCard({
  label,
  value,
  loading,
}: {
  label: string;
  value: string | number;
  loading?: boolean;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs font-semibold text-muted-foreground">
          {label}
        </div>
        {loading ? (
          <Skeleton className="mt-2 h-7 w-24" />
        ) : (
          <div className="mt-1 text-2xl font-bold">{value}</div>
        )}
      </CardContent>
    </Card>
  );
}

function ExplorerButton({
  label,
  address,
}: {
  label: string;
  address?: string | null;
}) {
  const href = explorerAccountUrl(address);
  return href ? (
    <Button asChild size="sm" variant="secondary">
      <a href={href} target="_blank" rel="noreferrer">
        {label}
        <ExternalLink className="h-4 w-4" />
      </a>
    </Button>
  ) : null;
}

export function ProfileDashboard({ compact = false }: { compact?: boolean }) {
  const queryClient = useQueryClient();
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() || null;
  const onchain = useGrowfiOnchainState();
  const growMint = clientGrowMintFromConfig(onchain.data?.config);
  const treasuryVault = clientTreasuryVaultFromConfig(onchain.data?.config);
  const balances = useWalletBalances({ mintAddress: growMint });
  const onchainMarketplace = useGrowfiMarketplaceListings();

  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<MeResponse>("/api/me"),
  });
  const { data: activity } = useQuery({
    queryKey: ["activity"],
    queryFn: () => apiFetch<ActivityResponse>("/api/activity"),
  });
  const { data: dbMarketplace } = useQuery({
    queryKey: ["marketplace"],
    queryFn: () => apiFetch<MarketplaceListingResponse>("/api/marketplace"),
  });

  const marketplace = useMemo(
    () => mergeMarketplaceListings(dbMarketplace, onchainMarketplace.data),
    [dbMarketplace, onchainMarketplace.data],
  );

  if (isLoading || !data) {
    return <LoadingState label="Loading profile" />;
  }

  const farm = onchain.data?.farm as FarmLike | null | undefined;
  const player = onchain.data?.player as PlayerLike | null | undefined;
  const playerExists = Boolean(player);
  const farmExists = Boolean(farm);
  const farmLevel = farm?.level ?? player?.gardenLevel ?? data.user.gardenLevel;
  const farmSize =
    farm?.width && farm?.height
      ? `${farm.width}x${farm.height}`
      : farmExists
        ? "Farm account found"
        : "Farm not created yet";
  const activeListings = marketplace.myListings.filter(
    (listing) => listing.status === "ACTIVE",
  ).length;
  const soldListings = marketplace.myListings.filter(
    (listing) => listing.status === "SOLD",
  ).length;
  const walletForDisplay = walletAddress || data.user.walletAddress;
  const programId = getGrowfiCoreProgramId().toBase58();

  const refreshAll = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["me"] }),
      queryClient.invalidateQueries({ queryKey: ["activity"] }),
      queryClient.invalidateQueries({ queryKey: ["marketplace"] }),
      queryClient.invalidateQueries({ queryKey: ["growfi-onchain-state"] }),
      queryClient.invalidateQueries({
        queryKey: ["growfi-onchain-marketplace"],
      }),
      queryClient.invalidateQueries({ queryKey: ["wallet-balances"] }),
    ]);
  };

  return (
    <div className={`grid gap-4 ${compact ? "" : "lg:grid-cols-[340px_1fr]"}`}>
      <Card>
        <CardContent className="space-y-4 p-5">
          <div className="flex items-center gap-3">
            <Avatar className="h-16 w-16 rounded-lg">
              <AvatarImage src={data.user.avatarUrl || undefined} />
              <AvatarFallback className="rounded-lg text-xl">
                {data.user.username.slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div>
              <div className="text-xl font-bold">{data.user.username}</div>
              <div className="text-sm text-muted-foreground">
                Joined {new Date(data.user.createdAt).toLocaleDateString()}
              </div>
            </div>
          </div>
          <Separator />
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-semibold text-muted-foreground">
                Connected Wallet
              </span>
              <Badge variant={walletAddress ? "default" : "outline"}>
                {walletAddress ? "Connected" : "Not connected"}
              </Badge>
            </div>
            <div className="break-all text-sm font-semibold">
              {walletForDisplay || "Wallet not connected"}
            </div>
            <ExplorerButton
              label="Wallet Explorer"
              address={walletForDisplay}
            />
          </div>
          <StaminaBar
            stamina={data.user.stamina}
            maxStamina={data.user.maxStamina}
          />
          <div className="grid gap-2">
            <Button asChild className="w-full">
              <Link href="/game">
                Visit Farm
                <ExternalLink className="h-4 w-4" />
              </Link>
            </Button>
            <Button
              className="w-full"
              type="button"
              variant="secondary"
              onClick={refreshAll}
            >
              <RefreshCw className="h-4 w-4" />
              Refresh Profile
            </Button>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="min-w-0">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="wallet">Wallet</TabsTrigger>
          <TabsTrigger value="onchain">On-chain</TabsTrigger>
          <TabsTrigger value="activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Wallet $GROW Balance"
              value={(balances.data?.grow?.balance ?? 0).toLocaleString()}
              loading={balances.isLoading}
            />
            <StatCard label="Farm Level" value={farmLevel} />
            <StatCard
              label="Total Harvests"
              value={
                playerExists
                  ? asNumber(player?.totalHarvests)
                  : data.user.totalHarvests
              }
            />
            <StatCard label="Active Listings" value={activeListings} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Farm Size" value={farmSize} />
            <StatCard
              label="Total Trades"
              value={
                playerExists
                  ? asNumber(player?.totalTrades)
                  : data.user.totalTrades
              }
            />
            <StatCard label="Sold Listings" value={soldListings} />
            <StatCard
              label="Indexed Actions"
              value={data.stats.transactionCount}
            />
          </div>
        </TabsContent>

        <TabsContent value="wallet" className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <StatCard
              label="SOL Balance"
              value={`${(balances.data?.sol ?? 0).toLocaleString()} SOL`}
              loading={balances.isLoading}
            />
            <StatCard
              label="$GROW Token Balance"
              value={`${(balances.data?.grow?.balance ?? 0).toLocaleString()} $GROW`}
              loading={balances.isLoading}
            />
          </div>
          <Card>
            <CardContent className="space-y-3 p-4">
              <div>
                <div className="text-xs font-semibold text-muted-foreground">
                  Cluster
                </div>
                <div className="font-semibold">
                  {process.env.NEXT_PUBLIC_TOKEN_CLUSTER || "devnet"}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground">
                  Token Mint
                </div>
                <div className="break-all text-sm font-semibold">
                  {growMint || "Token mint not configured"}
                </div>
              </div>
              <div>
                <div className="text-xs font-semibold text-muted-foreground">
                  Treasury/Vault Account
                </div>
                <div className="break-all text-sm font-semibold">
                  {treasuryVault || "Treasury vault not configured"}
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <ExplorerButton label="Token Mint" address={growMint} />
                <ExplorerButton label="Treasury" address={treasuryVault} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="onchain" className="mt-4 space-y-4">
          <div className="grid gap-3 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  Player PDA
                  <Badge variant={playerExists ? "default" : "outline"}>
                    {playerExists ? "Created" : "Missing"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="break-all font-semibold">
                  {onchain.data?.playerPda?.toBase58() ||
                    "Player account not created yet"}
                </div>
                <ExplorerButton
                  label="Player Explorer"
                  address={onchain.data?.playerPda?.toBase58()}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between gap-2 text-base">
                  Farm PDA
                  <Badge variant={farmExists ? "default" : "outline"}>
                    {farmExists ? "Created" : "Missing"}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="break-all font-semibold">
                  {onchain.data?.farmPda?.toBase58() || "Farm not created yet"}
                </div>
                <div className="text-muted-foreground">
                  Level {farmLevel} · {farmSize}
                </div>
                <ExplorerButton
                  label="Farm Explorer"
                  address={onchain.data?.farmPda?.toBase58()}
                />
              </CardContent>
            </Card>
          </div>
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="text-xs font-semibold text-muted-foreground">
                GrowFi Program ID
              </div>
              <div className="break-all text-sm font-semibold">{programId}</div>
              <ExplorerButton label="Program Explorer" address={programId} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="activity" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle>Recent Activity</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {(activity?.logs || []).length === 0 ? (
                <EmptyState title="No activity yet" />
              ) : null}
              {(activity?.logs || []).slice(0, compact ? 8 : 14).map((log) => (
                <div key={log.id} className="rounded-md bg-muted px-3 py-2">
                  <div className="text-sm font-semibold">{log.message}</div>
                  <div className="text-xs text-muted-foreground">
                    {log.type.toLowerCase().replaceAll("_", " ")} ·{" "}
                    {new Date(log.createdAt).toLocaleString()}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
