"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ExternalLink } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  EmptyState,
  LoadingState,
} from "@/components/game/shared/StatusStates";
import { StaminaBar } from "@/components/game/shared/StaminaBar";
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

export function ProfileDashboard({ compact = false }: { compact?: boolean }) {
  const { data, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<MeResponse>("/api/me"),
  });
  const { data: activity } = useQuery({
    queryKey: ["activity"],
    queryFn: () => apiFetch<ActivityResponse>("/api/activity"),
  });

  if (isLoading || !data) {
    return <LoadingState label="Loading profile" />;
  }

  const stats = [
    ["Available $GROW", data.user.availableGrow],
    ["Locked $GROW", data.user.lockedGrowBalance],
    ["Garden level", data.user.gardenLevel],
    ["Harvests", data.user.totalHarvests],
    ["Trades", data.user.totalTrades],
    ["Market sales", data.user.marketplaceSales],
    ["Active listings", data.stats.activeListings],
    ["Active trades", data.stats.activeTrades],
  ];

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
          <div>
            <div className="text-xs font-semibold text-muted-foreground">
              Wallet
            </div>
            <div className="break-all text-sm font-semibold">
              {data.user.walletAddress || "Not connected"}
            </div>
          </div>
          <StaminaBar
            stamina={data.user.stamina}
            maxStamina={data.user.maxStamina}
          />
          <Button asChild className="w-full">
            <Link href={`/game`}>
              Visit Farm
              <ExternalLink className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map(([label, value]) => (
            <Card key={label}>
              <CardContent className="p-4">
                <div className="text-xs font-semibold text-muted-foreground">
                  {label}
                </div>
                <div className="mt-1 text-2xl font-bold">{value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
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
      </div>
    </div>
  );
}
