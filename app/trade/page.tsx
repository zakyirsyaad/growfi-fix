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
    refetchInterval: 15_000
  });
  const { data: inventory } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => apiFetch<InventoryResponse>("/api/inventory")
  });
  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<MeResponse>("/api/me")
  });

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
      queryClient.invalidateQueries({ queryKey: ["me"] }),
      queryClient.invalidateQueries({ queryKey: ["activity"] })
    ]);
  };

  const createMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/trades/create", {
        method: "POST",
        body: JSON.stringify({ recipientUsername })
      }),
    onSuccess: async () => {
      setRecipientUsername("");
      setError(null);
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
    onSuccess: invalidate,
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
    onSuccess: invalidate,
    onError: (err) => setError(err instanceof Error ? err.message : "Could not add $GROW")
  });
  const confirmMutation = useMutation({
    mutationFn: (tradeId: string) =>
      apiFetch<ConfirmTradeResponse>("/api/trades/confirm", {
        method: "POST",
        body: JSON.stringify({ tradeId })
      }),
    onSuccess: async (result) => {
      toast.success(result.trade.status === "COMPLETED" ? "Trade completed" : "Trade confirmed");
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
    onSuccess: invalidate,
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
      <PageHeader title="Direct Trade" eyebrow="Five minute offers" />

      {error ? (
        <div className="mb-4 rounded-lg bg-berry-100 px-4 py-3 text-sm font-bold text-berry-700">
          {error}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[380px_1fr]">
        <aside className="space-y-5">
          <Card className="space-y-3">
            <CardTitle>New Trade</CardTitle>
            <input
              value={recipientUsername}
              onChange={(event) => setRecipientUsername(event.target.value)}
              placeholder="Discord username"
              className="h-10 w-full rounded-lg border border-leaf-200 px-3 text-sm font-bold"
            />
            <Button
              className="w-full"
              onClick={() => createMutation.mutate()}
              disabled={!recipientUsername || createMutation.isPending}
            >
              Create trade
            </Button>
          </Card>

          <Card className="space-y-3">
            <CardTitle>Add Offer</CardTitle>
            <select
              value={selectedTrade?.id || ""}
              onChange={(event) => setSelectedTradeId(event.target.value)}
              className="h-10 w-full rounded-lg border border-leaf-200 bg-white px-3 text-sm font-bold"
            >
              {activeTrades.length === 0 ? <option value="">No active trades</option> : null}
              {activeTrades.map((trade) => {
                const other = trade.initiatorId === me?.user.id ? trade.recipient : trade.initiator;
                return (
                  <option key={trade.id} value={trade.id}>
                    {other.username} · {trade.status.toLowerCase()}
                  </option>
                );
              })}
            </select>

            <div className="rounded-lg bg-white/65 p-3">
              <div className="mb-2 text-sm font-black text-leaf-800">Fruit</div>
              <select
                value={selectedFruitId}
                onChange={(event) => setSelectedFruitId(event.target.value)}
                className="h-10 w-full rounded-lg border border-leaf-200 bg-white px-3 text-sm font-bold"
              >
                <option value="">Choose fruit</option>
                {(inventory?.fruits || []).map((fruit) => (
                  <option key={fruit.id} value={fruit.id}>
                    {fruit.fruit.iconUrl} {fruit.mutation.toLowerCase()} {fruit.fruit.name} x
                    {fruit.quantity - fruit.lockedQuantity}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                value={fruitQuantity}
                onChange={(event) => setFruitQuantity(Number(event.target.value))}
                className="mt-2 h-10 w-full rounded-lg border border-leaf-200 px-3 text-sm font-bold"
              />
              <Button
                className="mt-2 w-full"
                variant="secondary"
                onClick={() => addFruitMutation.mutate()}
                disabled={!selectedTrade || !selectedFruitId || addFruitMutation.isPending}
              >
                Add fruit
              </Button>
            </div>

            <div className="rounded-lg bg-white/65 p-3">
              <div className="mb-2 text-sm font-black text-leaf-800">
                $GROW available: {me?.user.availableGrow ?? 0}
              </div>
              <input
                type="number"
                min={1}
                value={growAmount}
                onChange={(event) => setGrowAmount(Number(event.target.value))}
                className="h-10 w-full rounded-lg border border-leaf-200 px-3 text-sm font-bold"
              />
              <Button
                className="mt-2 w-full"
                variant="secondary"
                onClick={() => addGrowMutation.mutate()}
                disabled={!selectedTrade || addGrowMutation.isPending}
              >
                Add $GROW
              </Button>
            </div>
          </Card>
        </aside>

        <section className="space-y-4">
          <CardTitle>Trades</CardTitle>
          {!tradesData || !me ? (
            <Card className="font-bold text-leaf-800">Loading trades...</Card>
          ) : tradesData.trades.length === 0 ? (
            <Card className="font-bold text-leaf-800">No trades yet.</Card>
          ) : (
            tradesData.trades.map((trade) => (
              <TradeCard
                key={trade.id}
                trade={trade}
                currentUserId={me.user.id}
                onConfirm={() => confirmMutation.mutate(trade.id)}
                onCancel={() => cancelMutation.mutate(trade.id)}
                onRemoveItem={(itemId) => removeMutation.mutate({ tradeId: trade.id, itemId })}
                busy={confirmMutation.isPending || cancelMutation.isPending || removeMutation.isPending}
              />
            ))
          )}
        </section>
      </div>
    </>
  );
}

export default function TradePage() {
  return (
    <AuthGate>
      <TradeContent />
    </AuthGate>
  );
}
