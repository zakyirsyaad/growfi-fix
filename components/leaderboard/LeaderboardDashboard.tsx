"use client";

import { useQuery } from "@tanstack/react-query";
import { Crown, Gem, Sprout, Store, Trophy } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState, LoadingState } from "@/components/game/shared/StatusStates";
import { apiFetch } from "@/lib/utils/fetcher";

type LeaderUser = {
  id: string;
  username: string;
  avatarUrl?: string | null;
  growBalance: number;
  totalHarvests: number;
  totalTrades: number;
  marketplaceSales: number;
};

type LeaderboardResponse = {
  harvests: LeaderUser[];
  balances: LeaderUser[];
  trades: LeaderUser[];
  marketplace: LeaderUser[];
};

function Board({
  title,
  users,
  metric,
  icon: Icon
}: {
  title: string;
  users: LeaderUser[];
  metric: (user: LeaderUser) => number;
  icon: typeof Trophy;
}) {
  if (users.length === 0) {
    return <EmptyState title="No farmers yet" />;
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Rank</TableHead>
          <TableHead>Farmer</TableHead>
          <TableHead className="text-right">{title}</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user, index) => (
          <TableRow key={user.id}>
            <TableCell>
              <Badge variant={index === 0 ? "legendary" : "outline"} className="gap-1">
                <Icon className="h-3.5 w-3.5" />
                {index + 1}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="flex items-center gap-3">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.avatarUrl || undefined} />
                  <AvatarFallback>{user.username.slice(0, 1).toUpperCase()}</AvatarFallback>
                </Avatar>
                <span className="font-semibold">{user.username}</span>
              </div>
            </TableCell>
            <TableCell className="text-right font-bold">{metric(user)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

export function LeaderboardDashboard({ compact = false }: { compact?: boolean }) {
  const { data, isLoading } = useQuery({
    queryKey: ["leaderboard"],
    queryFn: () => apiFetch<LeaderboardResponse>("/api/leaderboard")
  });

  if (isLoading || !data) {
    return <LoadingState label="Loading leaderboard" />;
  }

  const highlights = [
    { label: "Richest farmer", value: data.balances[0]?.username || "Open", icon: Crown },
    { label: "Most harvests", value: data.harvests[0]?.username || "Open", icon: Sprout },
    { label: "Rarest mutation", value: "Rainbow watch", icon: Gem },
    { label: "Top seller", value: data.marketplace[0]?.username || "Open", icon: Store }
  ];

  return (
    <div className="space-y-4">
      {!compact ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {highlights.map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.label}>
                <CardContent className="flex items-center gap-3 p-4">
                  <span className="grid h-10 w-10 place-items-center rounded-md bg-secondary text-primary">
                    <Icon className="h-5 w-5" />
                  </span>
                  <span>
                    <span className="block text-xs font-semibold text-muted-foreground">{item.label}</span>
                    <span className="font-bold">{item.value}</span>
                  </span>
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Farmer Rankings</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="harvests">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="harvests">Harvest</TabsTrigger>
              <TabsTrigger value="balances">Richest</TabsTrigger>
              <TabsTrigger value="trades">Trades</TabsTrigger>
              <TabsTrigger value="market">Market</TabsTrigger>
            </TabsList>
            <TabsContent value="harvests"><Board title="Harvests" users={data.harvests} metric={(user) => user.totalHarvests} icon={Sprout} /></TabsContent>
            <TabsContent value="balances"><Board title="$GROW" users={data.balances} metric={(user) => user.growBalance} icon={Crown} /></TabsContent>
            <TabsContent value="trades"><Board title="Trades" users={data.trades} metric={(user) => user.totalTrades} icon={Trophy} /></TabsContent>
            <TabsContent value="market"><Board title="Sales" users={data.marketplace} metric={(user) => user.marketplaceSales} icon={Store} /></TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
