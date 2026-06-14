"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Handshake, Search, Sprout, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { ResponsivePanel } from "@/components/game/overlays/ResponsivePanel";
import { EmptyState, ErrorState } from "@/components/game/shared/StatusStates";
import { apiFetch } from "@/lib/utils/fetcher";
import { gameEventBus } from "@/lib/game/eventBus";
import { sendTradeInvite } from "@/lib/realtime/socketClient";
import type { OnlinePlayer } from "@/lib/realtime/types";
import type { PublicFarmResponse } from "@/types/game-data";

type SearchUser = {
  id: string;
  username: string;
  avatarUrl?: string | null;
  gardenLevel: number;
  totalHarvests: number;
  marketplaceSales: number;
};

type SearchResponse = { users: SearchUser[] };

export function VisitFarmOverlay({
  open,
  onOpenChange,
  onlinePlayers = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onlinePlayers?: OnlinePlayer[];
}) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ["farm-search", query],
    queryFn: () =>
      apiFetch<SearchResponse>(
        `/api/farms/search?query=${encodeURIComponent(query)}`,
      ),
    enabled: open,
  });

  const visitMutation = useMutation({
    mutationFn: (userId: string) =>
      apiFetch<PublicFarmResponse>(`/api/farms/${userId}`),
    onSuccess: (farm) => {
      setError(null);
      toast.success(`Visiting ${farm.owner.username}'s farm`);
      onOpenChange(false);
      gameEventBus.emit("visitorFarmLoaded", farm);
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : "Could not load farm"),
  });

  return (
    <ResponsivePanel
      open={open}
      onOpenChange={onOpenChange}
      title="Farm Visit Portal"
      description="Find online farmers and popular farms."
    >
      {error ? (
        <div className="mb-3">
          <ErrorState message={error} />
        </div>
      ) : null}
      {onlinePlayers.length > 0 ? (
        <div className="mb-4 space-y-2">
          <div className="text-sm font-bold">Online nearby</div>
          {onlinePlayers.slice(0, 5).map((player) => (
            <Card key={player.userId} className="bg-white/82">
              <CardContent className="flex items-center gap-3 p-3">
                <Avatar className="h-9 w-9 rounded-md">
                  <AvatarImage src={player.avatarUrl || undefined} />
                  <AvatarFallback className="rounded-md">
                    {player.username.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-black">{player.username}</div>
                  <div className="text-xs text-muted-foreground">
                    {player.currentRoom}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => visitMutation.mutate(player.userId)}
                >
                  <Sprout className="h-4 w-4" />
                  Visit
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    gameEventBus.emit("openOverlay", {
                      overlay: "profilePreview",
                      payload: player,
                    })
                  }
                >
                  <UserRound className="h-4 w-4" />
                </Button>
                <Button
                  size="sm"
                  onClick={() =>
                    sendTradeInvite(player.userId, player.currentRoom)
                  }
                >
                  <Handshake className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : null}
      <Command shouldFilter={false}>
        <CommandInput
          placeholder="Search farmers..."
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>
            {query ? "No farmers found." : "No popular farms yet."}
          </CommandEmpty>
          <CommandGroup heading={query ? "Farmers" : "Popular farms"}>
            {(data?.users || []).map((user) => (
              <CommandItem
                key={user.id}
                value={user.username}
                onSelect={() => visitMutation.mutate(user.id)}
              >
                <Avatar className="mr-2 h-8 w-8">
                  <AvatarImage src={user.avatarUrl || undefined} />
                  <AvatarFallback>
                    {user.username.slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <span className="flex-1">
                  <span className="block font-semibold">{user.username}</span>
                  <span className="text-xs text-muted-foreground">
                    Level {user.gardenLevel} · {user.totalHarvests} harvests
                  </span>
                </span>
                <Button size="sm" disabled={visitMutation.isPending}>
                  Visit
                </Button>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
      {!query && !data?.users.length ? (
        <Card className="mt-4 bg-white/75">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-secondary text-primary">
              <Search className="h-5 w-5" />
            </span>
            <div>
              <div className="font-semibold">Search and visit</div>
              <div className="text-sm text-muted-foreground">
                Visitors can view crops and owner stats, then request a direct
                trade.
              </div>
            </div>
          </CardContent>
        </Card>
      ) : data?.users.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="No farms found" />
        </div>
      ) : null}
      <Button
        className="mt-4 w-full"
        variant="secondary"
        onClick={() => gameEventBus.emit("returnHome")}
      >
        <Sprout className="h-4 w-4" />
        Return Home Farm
      </Button>
    </ResponsivePanel>
  );
}
