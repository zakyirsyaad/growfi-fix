"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Search, Sprout } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { ResponsivePanel } from "@/components/game/overlays/ResponsivePanel";
import { EmptyState, ErrorState } from "@/components/game/shared/StatusStates";
import { apiFetch } from "@/lib/utils/fetcher";
import { gameEventBus } from "@/lib/game/eventBus";
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
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const { data } = useQuery({
    queryKey: ["farm-search", query],
    queryFn: () => apiFetch<SearchResponse>(`/api/farms/search?query=${encodeURIComponent(query)}`),
    enabled: open && query.trim().length > 0
  });

  const visitMutation = useMutation({
    mutationFn: (userId: string) => apiFetch<PublicFarmResponse>(`/api/farms/${userId}`),
    onSuccess: (farm) => {
      setError(null);
      toast.success(`Visiting ${farm.owner.username}'s farm`);
      onOpenChange(false);
      gameEventBus.emit("visitorFarmLoaded", farm);
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Could not load farm")
  });

  return (
    <ResponsivePanel open={open} onOpenChange={onOpenChange} title="Visit Other Farms" description="Search by Discord username. MVP visits are read-only.">
      {error ? <div className="mb-3"><ErrorState message={error} /></div> : null}
      <Command shouldFilter={false}>
        <CommandInput placeholder="Search farmers..." value={query} onValueChange={setQuery} />
        <CommandList>
          <CommandEmpty>
            {query ? "No farmers found." : "Type a username to search."}
          </CommandEmpty>
          <CommandGroup heading="Farmers">
            {(data?.users || []).map((user) => (
              <CommandItem key={user.id} value={user.username} onSelect={() => visitMutation.mutate(user.id)}>
                <Avatar className="mr-2 h-8 w-8">
                  <AvatarImage src={user.avatarUrl || undefined} />
                  <AvatarFallback>{user.username.slice(0, 1).toUpperCase()}</AvatarFallback>
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
      {!query ? (
        <Card className="mt-4 bg-white/75">
          <CardContent className="flex items-center gap-3 p-4">
            <span className="grid h-10 w-10 place-items-center rounded-md bg-secondary text-primary">
              <Search className="h-5 w-5" />
            </span>
            <div>
              <div className="font-semibold">Search and visit</div>
              <div className="text-sm text-muted-foreground">
                Visitors can view crops and owner stats, then request a direct trade.
              </div>
            </div>
          </CardContent>
        </Card>
      ) : data?.users.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="No farms found" />
        </div>
      ) : null}
      <Button className="mt-4 w-full" variant="secondary" onClick={() => gameEventBus.emit("returnHome")}>
        <Sprout className="h-4 w-4" />
        Return Home Farm
      </Button>
    </ResponsivePanel>
  );
}
