"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResponsivePanel } from "@/components/game/overlays/ResponsivePanel";
import { CountdownBadge } from "@/components/game/shared/CountdownBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/game/shared/StatusStates";
import { MutationBadge } from "@/components/game/shared/MutationBadge";
import { apiFetch } from "@/lib/utils/fetcher";
import type { InventoryResponse, Mutation } from "@/types/game-data";

type TradeView = {
  id: string;
  initiatorId: string;
  recipientId: string;
  status: "PENDING" | "ACTIVE" | "LOCKED" | "COMPLETED" | "CANCELLED" | "EXPIRED";
  initiatorConfirmed: boolean;
  recipientConfirmed: boolean;
  expiresAt: string;
  initiator: { id: string; username: string; avatarUrl?: string | null };
  recipient: { id: string; username: string; avatarUrl?: string | null };
  items: Array<{
    id: string;
    userId: string;
    type: "FRUIT" | "GROW";
    quantity: number;
    growAmount: number;
    mutation?: Mutation | null;
    fruit?: { name: string; iconUrl: string } | null;
    user: { id: string; username: string };
  }>;
};

type TradesResponse = { trades: TradeView[] };
type MeResponse = { user: { id: string; availableGrow: number } };

function OfferColumn({
  title,
  userId,
  trade,
  currentUserId,
  onRemove
}: {
  title: string;
  userId: string;
  trade: TradeView;
  currentUserId?: string;
  onRemove: (itemId: string) => void;
}) {
  const items = trade.items.filter((item) => item.userId === userId);
  const confirmed = userId === trade.initiatorId ? trade.initiatorConfirmed : trade.recipientConfirmed;
  const active = ["PENDING", "ACTIVE", "LOCKED"].includes(trade.status);

  return (
    <Card className="bg-white/78">
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center justify-between text-base">
          {title}
          {confirmed ? (
            <Badge variant="secondary" className="gap-1">
              <CheckCircle2 className="h-3.5 w-3.5" />
              locked
            </Badge>
          ) : (
            <Badge variant="outline">open</Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2 p-4 pt-0">
        {items.length === 0 ? <div className="rounded-md bg-muted p-3 text-sm text-muted-foreground">No offer items.</div> : null}
        {items.map((item) => (
          <div key={item.id} className="flex items-center justify-between gap-2 rounded-md bg-white/80 px-3 py-2 text-sm">
            <span className="font-semibold">
              {item.type === "GROW"
                ? `${item.growAmount} $GROW`
                : `${item.fruit?.iconUrl || ""} ${item.quantity} ${item.fruit?.name || "Fruit"}`}
            </span>
            <span className="flex items-center gap-2">
              {item.mutation ? <MutationBadge mutation={item.mutation} /> : null}
              {active && item.userId === currentUserId ? (
                <button className="rounded-md p-1 text-destructive hover:bg-destructive/10" onClick={() => onRemove(item.id)}>
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </span>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

export function TradeOverlay({
  open,
  onOpenChange,
  payload
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload?: unknown;
}) {
  const queryClient = useQueryClient();
  const [recipientUsername, setRecipientUsername] = useState("");
  const [selectedTradeId, setSelectedTradeId] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [selectedFruitId, setSelectedFruitId] = useState("");
  const [fruitQuantity, setFruitQuantity] = useState(1);
  const [growAmount, setGrowAmount] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const { data: tradesData, isLoading } = useQuery({
    queryKey: ["trades"],
    queryFn: () => apiFetch<TradesResponse>("/api/trades"),
    refetchInterval: 15_000,
    enabled: open
  });
  const { data: inventory } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => apiFetch<InventoryResponse>("/api/inventory"),
    enabled: open
  });
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<MeResponse>("/api/me"),
    enabled: open
  });

  useEffect(() => {
    const value = payload as { recipientUsername?: string; recipientId?: string } | undefined;
    if (open && value?.recipientUsername) {
      setRecipientUsername(value.recipientUsername);
    }
  }, [open, payload]);

  const activeTrades = useMemo(
    () =>
      tradesData?.trades.filter((trade) =>
        ["PENDING", "ACTIVE", "LOCKED"].includes(trade.status)
      ) || [],
    [tradesData]
  );
  const selectedTrade = activeTrades.find((trade) => trade.id === selectedTradeId) || activeTrades[0];

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["trades"] }),
      queryClient.invalidateQueries({ queryKey: ["inventory"] }),
      queryClient.invalidateQueries({ queryKey: ["me"] })
    ]);
  };

  const createMutation = useMutation({
    mutationFn: () => {
      const value = payload as { recipientId?: string } | undefined;
      return apiFetch("/api/trades/create", {
        method: "POST",
        body: JSON.stringify(value?.recipientId ? { recipientId: value.recipientId } : { recipientUsername })
      });
    },
    onSuccess: async () => {
      setError(null);
      toast.success("Trade created");
      await invalidate();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Trade create failed")
  });

  const addFruitMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/trades/add-item", {
        method: "POST",
        body: JSON.stringify({
          tradeId: selectedTrade?.id,
          type: "FRUIT",
          userFruitId: selectedFruitId,
          quantity: fruitQuantity
        })
      }),
    onSuccess: async () => {
      setError(null);
      toast.success("Trade offer updated");
      setAddOpen(false);
      await invalidate();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Could not add fruit")
  });

  const addGrowMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/trades/add-item", {
        method: "POST",
        body: JSON.stringify({
          tradeId: selectedTrade?.id,
          type: "GROW",
          growAmount
        })
      }),
    onSuccess: async () => {
      setError(null);
      toast.success("Trade offer updated");
      setAddOpen(false);
      await invalidate();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Could not add $GROW")
  });

  const confirmMutation = useMutation({
    mutationFn: (tradeId: string) =>
      apiFetch("/api/trades/confirm", {
        method: "POST",
        body: JSON.stringify({ tradeId })
      }),
    onSuccess: async () => {
      setError(null);
      toast.success("Trade confirmed");
      await invalidate();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Confirm failed")
  });

  const cancelMutation = useMutation({
    mutationFn: (tradeId: string) =>
      apiFetch("/api/trades/cancel", {
        method: "POST",
        body: JSON.stringify({ tradeId })
      }),
    onSuccess: async () => {
      setError(null);
      toast.success("Trade cancelled");
      await invalidate();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Cancel failed")
  });

  const removeMutation = useMutation({
    mutationFn: ({ tradeId, itemId }: { tradeId: string; itemId: string }) =>
      apiFetch("/api/trades/remove-item", {
        method: "POST",
        body: JSON.stringify({ tradeId, itemId })
      }),
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof Error ? err.message : "Remove failed")
  });

  return (
    <>
      <ResponsivePanel open={open} onOpenChange={onOpenChange} title="Direct Trade" description="Create asynchronous offers, lock them, then both sides confirm." wide>
        {error ? <div className="mb-3"><ErrorState message={error} /></div> : null}
        {isLoading || !tradesData || !me ? (
          <LoadingState label="Loading trades" />
        ) : (
          <div className="space-y-4">
            <Card className="bg-white/80">
              <CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_auto]">
                <div>
                  <Label>Recipient Discord username</Label>
                  <Input value={recipientUsername} onChange={(event) => setRecipientUsername(event.target.value)} placeholder="farmer-name" />
                </div>
                <div className="flex items-end">
                  <Button disabled={(!recipientUsername && !(payload as { recipientId?: string } | undefined)?.recipientId) || createMutation.isPending} onClick={() => createMutation.mutate()}>
                    Create Trade
                  </Button>
                </div>
              </CardContent>
            </Card>

            {tradesData.trades.length === 0 ? (
              <EmptyState title="No trades yet" description="Start one from a username or while visiting another farm." />
            ) : (
              <div className="space-y-4">
                {tradesData.trades.map((trade) => {
                  const active = ["PENDING", "ACTIVE", "LOCKED"].includes(trade.status);
                  const other = trade.initiatorId === me.user.id ? trade.recipient : trade.initiator;
                  const myConfirmed =
                    trade.initiatorId === me.user.id ? trade.initiatorConfirmed : trade.recipientConfirmed;
                  const theirConfirmed =
                    trade.initiatorId === me.user.id ? trade.recipientConfirmed : trade.initiatorConfirmed;
                  return (
                    <Card key={trade.id} className="bg-white/80">
                      <CardContent className="space-y-4 p-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div>
                            <div className="text-xs font-semibold text-muted-foreground">Trade with</div>
                            <div className="text-xl font-bold">{other.username}</div>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={trade.status === "COMPLETED" ? "default" : "outline"}>{trade.status.toLowerCase()}</Badge>
                            {active ? <CountdownBadge to={trade.expiresAt} /> : null}
                          </div>
                        </div>
                        <div className="grid gap-3 md:grid-cols-2">
                          <OfferColumn title={trade.initiator.username} userId={trade.initiatorId} trade={trade} currentUserId={me.user.id} onRemove={(itemId) => removeMutation.mutate({ tradeId: trade.id, itemId })} />
                          <OfferColumn title={trade.recipient.username} userId={trade.recipientId} trade={trade} currentUserId={me.user.id} onRemove={(itemId) => removeMutation.mutate({ tradeId: trade.id, itemId })} />
                        </div>
                        {active ? (
                          <div className="flex flex-wrap gap-2">
                            <Button
                              variant="secondary"
                              onClick={() => {
                                setSelectedTradeId(trade.id);
                                setAddOpen(true);
                              }}
                            >
                              <Plus className="h-4 w-4" />
                              Add Item
                            </Button>
                            <Button disabled={confirmMutation.isPending || myConfirmed} onClick={() => confirmMutation.mutate(trade.id)}>
                              Confirm
                            </Button>
                            <Button variant="outline" disabled={cancelMutation.isPending} onClick={() => cancelMutation.mutate(trade.id)}>
                              Cancel
                            </Button>
                            <div className="ml-auto text-sm text-muted-foreground">
                              You: {myConfirmed ? "confirmed" : "open"} · Them: {theirConfirmed ? "confirmed" : "open"}
                            </div>
                          </div>
                        ) : null}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </ResponsivePanel>
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add trade offer</DialogTitle>
            <DialogDescription>Changing an offer resets confirmations for both farmers.</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="fruit">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="fruit">Fruit</TabsTrigger>
              <TabsTrigger value="grow">$GROW</TabsTrigger>
            </TabsList>
            <TabsContent value="fruit" className="space-y-3">
              <Label>Fruit</Label>
              <Select value={selectedFruitId || "none"} onValueChange={(value) => setSelectedFruitId(value === "none" ? "" : value)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Choose fruit</SelectItem>
                  {(inventory?.fruits || []).map((fruit) => (
                    <SelectItem key={fruit.id} value={fruit.id}>
                      {fruit.fruit.iconUrl} {fruit.mutation.toLowerCase()} {fruit.fruit.name} x{fruit.quantity - fruit.lockedQuantity}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Label>Quantity</Label>
              <Input type="number" min={1} value={fruitQuantity} onChange={(event) => setFruitQuantity(Number(event.target.value))} />
              <Button className="w-full" disabled={!selectedTrade || !selectedFruitId || addFruitMutation.isPending} onClick={() => addFruitMutation.mutate()}>
                Add Fruit
              </Button>
            </TabsContent>
            <TabsContent value="grow" className="space-y-3">
              <Label>$GROW amount</Label>
              <Input type="number" min={1} value={growAmount} onChange={(event) => setGrowAmount(Number(event.target.value))} />
              <p className="text-sm text-muted-foreground">Available: {me?.user.availableGrow ?? 0}</p>
              <Button className="w-full" disabled={!selectedTrade || addGrowMutation.isPending} onClick={() => addGrowMutation.mutate()}>
                Add $GROW
              </Button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
