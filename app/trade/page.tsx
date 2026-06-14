"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { AuthGate } from "@/components/layout/AuthGate";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card, CardTitle } from "@/components/ui/card";
import { FruitStackView } from "@/components/inventory/InventoryCards";
import { TradeCard, TradeView } from "@/components/trade/TradeCard";
import { apiFetch } from "@/lib/utils/fetcher";

type TradesResponse = { trades: TradeView[] };
type InventoryResponse = { fruits: FruitStackView[]; seeds: unknown[] };
type MeResponse = { user: { id: string; availableGrow: number } };
type ConfirmTradeResponse = { trade: TradeView };

function TradeContent() {
  const queryClient = useQueryClient();
  const [recipientUsername, setRecipientUsername] = useState("");
  const [selectedTradeId, setSelectedTradeId] = useState("");
  const [selectedFruitId, setSelectedFruitId] = useState("");
  const [fruitQuantity, setFruitQuantity] = useState(1);
  const [growAmount, setGrowAmount] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const { data: tradesData } = useQuery({
    queryKey: ["trades"],
    queryFn: () => apiFetch<TradesResponse>("/api/trades"),
    refetchInterval: 15_000,
  });
  const { data: inventory } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => apiFetch<InventoryResponse>("/api/inventory"),
  });
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<MeResponse>("/api/me"),
  });

  const activeTrades = useMemo(
    () =>
      tradesData?.trades.filter((trade) =>
        ["PENDING", "ACTIVE", "LOCKED"].includes(trade.status),
      ) || [],
    [tradesData],
  );
  const selectedTrade =
    activeTrades.find((trade) => trade.id === selectedTradeId) ||
    activeTrades[0];

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["trades"] }),
      queryClient.invalidateQueries({ queryKey: ["inventory"] }),
      queryClient.invalidateQueries({ queryKey: ["me"] }),
      queryClient.invalidateQueries({ queryKey: ["activity"] }),
    ]);
  };

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/trades/create", {
        method: "POST",
        body: JSON.stringify({ recipientUsername }),
      }),
    onSuccess: async () => {
      setRecipientUsername("");
      setError(null);
      await invalidate();
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : "Trade create failed"),
  });
  const addFruitMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/trades/add-item", {
        method: "POST",
        body: JSON.stringify({
          tradeId: selectedTrade?.id,
          type: "FRUIT",
          userFruitId: selectedFruitId,
          quantity: fruitQuantity,
        }),
      }),
    onSuccess: invalidate,
    onError: (err) =>
      setError(err instanceof Error ? err.message : "Could not add fruit"),
  });
  const addGrowMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/trades/add-item", {
        method: "POST",
        body: JSON.stringify({
          tradeId: selectedTrade?.id,
          type: "GROW",
          growAmount,
        }),
      }),
    onSuccess: invalidate,
    onError: (err) =>
      setError(err instanceof Error ? err.message : "Could not add $GROW"),
  });
  const confirmMutation = useMutation({
    mutationFn: (tradeId: string) =>
      apiFetch<ConfirmTradeResponse>("/api/trades/confirm", {
        method: "POST",
        body: JSON.stringify({ tradeId }),
      }),
    onSuccess: async (result) => {
      toast.success(
        result.trade.status === "COMPLETED"
          ? "Trade completed"
          : "Trade confirmed",
      );
      await invalidate();
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : "Confirm failed"),
  });
  const cancelMutation = useMutation({
    mutationFn: (tradeId: string) =>
      apiFetch("/api/trades/cancel", {
        method: "POST",
        body: JSON.stringify({ tradeId }),
      }),
    onSuccess: invalidate,
    onError: (err) =>
      setError(err instanceof Error ? err.message : "Cancel failed"),
  });
  const removeMutation = useMutation({
    mutationFn: ({ tradeId, itemId }: { tradeId: string; itemId: string }) =>
      apiFetch("/api/trades/remove-item", {
        method: "POST",
        body: JSON.stringify({ tradeId, itemId }),
      }),
    onSuccess: invalidate,
    onError: (err) =>
      setError(err instanceof Error ? err.message : "Remove failed"),
  });

  return (
    <div className="mt-8">
      <PageHeader title="Direct Trade" eyebrow="Five minute offers" />

      {error ? (
        <div className="mb-6 rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm font-bold text-destructive">
          {error}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[380px_1fr]">
        <aside className="space-y-6">
          <Card className="space-y-4 p-5">
            <CardTitle className="text-xl font-bold">New Trade</CardTitle>
            <input
              value={recipientUsername}
              onChange={(event) => setRecipientUsername(event.target.value)}
              placeholder="Discord username"
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-medium focus:outline-none focus:border-primary"
            />
            <Button
              className="w-full font-bold"
              onClick={() => createMutation.mutate()}
              disabled={!recipientUsername || createMutation.isPending}
            >
              Create trade
            </Button>
          </Card>

          <Card className="space-y-4 p-5">
            <CardTitle className="text-xl font-bold">Add Offer</CardTitle>
            <select
              value={selectedTrade?.id || ""}
              onChange={(event) => setSelectedTradeId(event.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-medium focus:outline-none focus:border-primary"
            >
              {activeTrades.length === 0 ? (
                <option value="">No active trades</option>
              ) : null}
              {activeTrades.map((trade) => {
                const other =
                  trade.initiatorId === me?.user.id
                    ? trade.recipient
                    : trade.initiator;
                return (
                  <option key={trade.id} value={trade.id}>
                    {other.username} · {trade.status.toLowerCase()}
                  </option>
                );
              })}
            </select>

            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <div className="text-sm font-bold text-foreground">Fruit</div>
              <select
                value={selectedFruitId}
                onChange={(event) => setSelectedFruitId(event.target.value)}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-medium focus:outline-none focus:border-primary"
              >
                <option value="">Choose fruit</option>
                {(inventory?.fruits || []).map((fruit) => (
                  <option key={fruit.id} value={fruit.id}>
                    {fruit.fruit.iconUrl} {fruit.mutation.toLowerCase()}{" "}
                    {fruit.fruit.name} x{fruit.quantity - fruit.lockedQuantity}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={fruitQuantity}
                onChange={(event) =>
                  setFruitQuantity(Number(event.target.value))
                }
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-medium focus:outline-none focus:border-primary"
              />
              <Button
                className="w-full font-bold"
                variant="outline"
                onClick={() => addFruitMutation.mutate()}
                disabled={
                  !selectedTrade ||
                  !selectedFruitId ||
                  addFruitMutation.isPending
                }
              >
                Add fruit
              </Button>
            </div>

            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <div className="text-sm font-bold text-foreground">
                $GROW available: {me?.user.availableGrow ?? 0}
              </div>
              <input
                type="number"
                min={1}
                value={growAmount}
                onChange={(event) => setGrowAmount(Number(event.target.value))}
                className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm font-medium focus:outline-none focus:border-primary"
              />
              <Button
                className="w-full font-bold"
                variant="outline"
                onClick={() => addGrowMutation.mutate()}
                disabled={!selectedTrade || addGrowMutation.isPending}
              >
                Add $GROW
              </Button>
            </div>
          </Card>
        </aside>

        <section className="space-y-5">
          <CardTitle className="text-2xl font-bold">Trades</CardTitle>
          {!tradesData || !me ? (
            <div className="p-8 border border-border bg-card rounded-xl shadow-sm text-center font-bold text-muted-foreground">
              Loading trades...
            </div>
          ) : tradesData.trades.length === 0 ? (
            <div className="p-8 border border-border bg-card rounded-xl shadow-sm text-center font-bold text-muted-foreground">
              No trades yet.
            </div>
          ) : (
            <div className="space-y-4">
              {tradesData.trades.map((trade) => (
                <TradeCard
                  key={trade.id}
                  trade={trade}
                  currentUserId={me.user.id}
                  onConfirm={() => confirmMutation.mutate(trade.id)}
                  onCancel={() => cancelMutation.mutate(trade.id)}
                  onRemoveItem={(itemId) =>
                    removeMutation.mutate({ tradeId: trade.id, itemId })
                  }
                  busy={
                    confirmMutation.isPending ||
                    cancelMutation.isPending ||
                    removeMutation.isPending
                  }
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default function TradePage() {
  return (
    <AuthGate>
      <TradeContent />
    </AuthGate>
  );
}
