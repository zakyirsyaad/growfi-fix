"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Handshake, Search, Sprout, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
          <div className="text-sm font-bold text-[#f2fbf1]">Online nearby</div>
          {onlinePlayers.slice(0, 5).map((player) => (
            <div
              key={player.userId}
              className="pixel-card flex items-center gap-3 p-3"
            >
              <Avatar className="h-9 w-9 rounded-md">
                <AvatarImage src={player.avatarUrl || undefined} />
                <AvatarFallback className="rounded-md">
                  {player.username.slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate font-black text-[#f2fbf1]">
                  {player.username}
                </div>
                <div className="text-xs text-[#91d985]">
                  {player.currentRoom}
                </div>
              </div>
              <button
                type="button"
                className="pixel-btn pixel-btn-ghost px-3 py-2"
                onClick={() => visitMutation.mutate(player.userId)}
              >
                <Sprout className="h-4 w-4" />
                VISIT
              </button>
              <button
                type="button"
                className="pixel-btn pixel-btn-ghost px-3 py-2"
                onClick={() =>
                  gameEventBus.emit("openOverlay", {
                    overlay: "profilePreview",
                    payload: player,
                  })
                }
              >
                <UserRound className="h-4 w-4" />
              </button>
              <button
                type="button"
                className="pixel-btn pixel-btn-primary px-3 py-2"
                onClick={() =>
                  sendTradeInvite(player.userId, player.currentRoom)
                }
              >
                <Handshake className="h-4 w-4" />
              </button>
            </div>
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
                  <span className="block font-semibold text-[#f2fbf1]">
                    {user.username}
                  </span>
                  <span className="text-xs text-[#91d985]">
                    Level {user.gardenLevel} · {user.totalHarvests} harvests
                  </span>
                </span>
                <button
                  type="button"
                  className="pixel-btn pixel-btn-primary px-3 py-2"
                  disabled={visitMutation.isPending}
                >
                  VISIT
                </button>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
      {!query && !data?.users.length ? (
        <div className="pixel-card mt-4 flex items-center gap-3 p-4">
          <span className="pixel-tile grid h-10 w-10 place-items-center text-[#91d985]">
            <Search className="h-5 w-5" />
          </span>
          <div>
            <div className="font-semibold text-[#f2fbf1]">Search and visit</div>
            <div className="text-sm text-[#91d985]">
              Visitors can view crops and owner stats, then request a direct
              trade.
            </div>
          </div>
        </div>
      ) : data?.users.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="No farms found" />
        </div>
      ) : null}
      <button
        type="button"
        className="pixel-btn pixel-btn-ghost mt-4 w-full px-4 py-2"
        onClick={() => gameEventBus.emit("returnHome")}
      >
        <Sprout className="h-4 w-4" />
        RETURN HOME FARM
      </button>
    </ResponsivePanel>
  );
}
