"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Plus, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResponsivePanel } from "@/components/game/overlays/ResponsivePanel";
import { CountdownBadge } from "@/components/game/shared/CountdownBadge";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/game/shared/StatusStates";
import { MutationBadge } from "@/components/game/shared/MutationBadge";
import { apiFetch } from "@/lib/utils/fetcher";
import type { OnlinePlayer } from "@/lib/realtime/types";
import type { InventoryResponse, Mutation } from "@/types/game-data";

type TradeView = {
  id: string;
  initiatorId: string;
  recipientId: string;
  status:
    | "PENDING"
    | "ACTIVE"
    | "LOCKED"
    | "COMPLETED"
    | "CANCELLED"
    | "EXPIRED";
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
type ConfirmTradeResponse = { trade: TradeView };

function OfferColumn({
  title,
  userId,
  trade,
  currentUserId,
  onRemove,
}: {
  title: string;
  userId: string;
  trade: TradeView;
  currentUserId?: string;
  onRemove: (itemId: string) => void;
}) {
  const items = trade.items.filter((item) => item.userId === userId);
  const confirmed =
    userId === trade.initiatorId
      ? trade.initiatorConfirmed
      : trade.recipientConfirmed;
  const active = ["PENDING", "ACTIVE", "LOCKED"].includes(trade.status);

  return (
    <div className="pixel-card space-y-2 p-4">
      <div className="flex items-center justify-between text-base font-bold text-[#f2fbf1]">
        {title}
        {confirmed ? (
          <span className="pixel-badge text-[#3d9f4b] gap-1">
            <CheckCircle2 className="h-3.5 w-3.5" />
            locked
          </span>
        ) : (
          <span className="pixel-badge text-[#91d985]">open</span>
        )}
      </div>
      {items.length === 0 ? (
        <div className="pixel-card-sunken p-3 text-sm text-[#91d985]">
          No offer items.
        </div>
      ) : null}
      {items.map((item) => (
        <div
          key={item.id}
          className="flex items-center justify-between gap-2 pixel-card-sunken px-3 py-2 text-sm"
        >
          <span className="font-semibold text-[#ddf5d9]">
            {item.type === "GROW"
              ? `${item.growAmount} $GROW`
              : `${item.fruit?.iconUrl || ""} ${item.quantity} ${item.fruit?.name || "Fruit"}`}
          </span>
          <span className="flex items-center gap-2">
            {item.mutation ? (
              <MutationBadge mutation={item.mutation} />
            ) : null}
            {active && item.userId === currentUserId ? (
              <button
                type="button"
                className="pixel-btn pixel-btn-danger h-6 w-6 p-0"
                onClick={() => onRemove(item.id)}
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </span>
        </div>
      ))}
    </div>
  );
}

export function TradeOverlay({
  open,
  onOpenChange,
  payload,
  onlinePlayers = [],
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  payload?: unknown;
  onlinePlayers?: OnlinePlayer[];
}) {
  const queryClient = useQueryClient();
  const [recipientUsername, setRecipientUsername] = useState("");
  const [selectedTradeId, setSelectedTradeId] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [selectedFruitId, setSelectedFruitId] = useState("");
  const [fruitQuantity, setFruitQuantity] = useState(1);
  const [growAmount, setGrowAmount] = useState(1);
  const [error, setError] = useState<string | null>(null);

  const {
    data: tradesData,
    isLoading,
    isError: tradesIsError,
    error: tradesQueryError,
    refetch: refetchTrades,
  } = useQuery({
    queryKey: ["trades"],
    queryFn: () => apiFetch<TradesResponse>("/api/trades"),
    refetchInterval: 15_000,
    enabled: open,
  });
  const {
    data: inventory,
    isError: inventoryIsError,
    error: inventoryQueryError,
  } = useQuery({
    queryKey: ["inventory"],
    queryFn: () => apiFetch<InventoryResponse>("/api/inventory"),
    enabled: open,
  });
  const {
    data: me,
    isError: meIsError,
    error: meQueryError,
  } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<MeResponse>("/api/me"),
    enabled: open,
  });

  useEffect(() => {
    const value = payload as
      | { recipientUsername?: string; recipientId?: string; tradeId?: string }
      | undefined;
    if (open && value?.recipientUsername) {
      setRecipientUsername(value.recipientUsername);
    }
    if (open && value?.tradeId) {
      setSelectedTradeId(value.tradeId);
    }
  }, [open, payload]);

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
    mutationFn: () => {
      const value = payload as { recipientId?: string } | undefined;
      return apiFetch("/api/trades/create", {
        method: "POST",
        body: JSON.stringify(
          value?.recipientId
            ? { recipientId: value.recipientId }
            : { recipientUsername },
        ),
      });
    },
    onSuccess: async () => {
      setError(null);
      toast.success("Trade created");
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
    onSuccess: async () => {
      setError(null);
      toast.success("Trade offer updated");
      setAddOpen(false);
      await invalidate();
    },
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
    onSuccess: async () => {
      setError(null);
      toast.success("Trade offer updated");
      setAddOpen(false);
      await invalidate();
    },
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
      setError(null);
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
    onSuccess: async () => {
      setError(null);
      toast.success("Trade cancelled");
      await invalidate();
    },
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
  const queryError =
    tradesIsError || inventoryIsError || meIsError
      ? tradesQueryError || inventoryQueryError || meQueryError
      : null;

  return (
    <>
      <ResponsivePanel
        open={open}
        onOpenChange={onOpenChange}
        title="Direct Trade"
        description="Create asynchronous offers, lock them, then both sides confirm."
        wide
      >
        {error ? (
          <div className="mb-3">
            <ErrorState message={error} />
          </div>
        ) : null}
        {queryError ? (
          <div className="space-y-3">
            <ErrorState
              message={
                queryError instanceof Error
                  ? queryError.message
                  : "Could not load direct trades."
              }
            />
            <button
              type="button"
              className="pixel-btn pixel-btn-ghost px-4 py-2"
              onClick={() => refetchTrades()}
            >
              REFRESH TRADES
            </button>
          </div>
        ) : isLoading || !tradesData || !me ? (
          <LoadingState label="Loading trades" />
        ) : (
          <div className="space-y-4">
            <div className="pixel-card space-y-3 p-4">
              {onlinePlayers.length > 0 ? (
                <div className="space-y-2">
                  <div className="pixel-label">Online farmers</div>
                  <div className="flex flex-wrap gap-2">
                    {onlinePlayers.slice(0, 8).map((player) => (
                      <button
                        key={player.userId}
                        type="button"
                        className="pixel-btn pixel-btn-ghost px-3 py-2"
                        onClick={() => setRecipientUsername(player.username)}
                      >
                        {player.username}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
              <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
                <div>
                  <Label className="pixel-label">
                    Recipient Discord username
                  </Label>
                  <Input
                    className="pixel-input mt-1 px-3 py-2"
                    value={recipientUsername}
                    onChange={(event) =>
                      setRecipientUsername(event.target.value)
                    }
                    placeholder="farmer-name"
                  />
                </div>
                <div className="flex items-end">
                  <button
                    type="button"
                    className="pixel-btn pixel-btn-primary px-4 py-2"
                    disabled={
                      (!recipientUsername &&
                        !(payload as { recipientId?: string } | undefined)
                          ?.recipientId) ||
                      createMutation.isPending
                    }
                    onClick={() => createMutation.mutate()}
                  >
                    CREATE TRADE
                  </button>
                </div>
              </div>
            </div>

            {tradesData.trades.length === 0 ? (
              <EmptyState
                title="No trades yet"
                description="Start one from a username or while visiting another farm."
              />
            ) : (
              <div className="space-y-4">
                {tradesData.trades.map((trade) => {
                  const active = ["PENDING", "ACTIVE", "LOCKED"].includes(
                    trade.status,
                  );
                  const other =
                    trade.initiatorId === me.user.id
                      ? trade.recipient
                      : trade.initiator;
                  const myConfirmed =
                    trade.initiatorId === me.user.id
                      ? trade.initiatorConfirmed
                      : trade.recipientConfirmed;
                  const theirConfirmed =
                    trade.initiatorId === me.user.id
                      ? trade.recipientConfirmed
                      : trade.initiatorConfirmed;
                  return (
                    <div key={trade.id} className="pixel-card space-y-4 p-4">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="pixel-label">Trade with</div>
                          <div className="text-xl font-bold text-[#f2fbf1]">
                            {other.username}
                          </div>
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`pixel-badge ${
                              trade.status === "COMPLETED"
                                ? "text-[#91d985]"
                                : "text-[#5e8c52]"
                            }`}
                          >
                            {trade.status}
                          </span>
                          {active ? (
                            <CountdownBadge to={trade.expiresAt} />
                          ) : null}
                        </div>
                      </div>
                      <div className="grid gap-3 md:grid-cols-2">
                        <OfferColumn
                          title={trade.initiator.username}
                          userId={trade.initiatorId}
                          trade={trade}
                          currentUserId={me.user.id}
                          onRemove={(itemId) =>
                            removeMutation.mutate({
                              tradeId: trade.id,
                              itemId,
                            })
                          }
                        />
                        <OfferColumn
                          title={trade.recipient.username}
                          userId={trade.recipientId}
                          trade={trade}
                          currentUserId={me.user.id}
                          onRemove={(itemId) =>
                            removeMutation.mutate({
                              tradeId: trade.id,
                              itemId,
                            })
                          }
                        />
                      </div>
                      {active ? (
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            className="pixel-btn pixel-btn-ghost px-3 py-2"
                            onClick={() => {
                              setSelectedTradeId(trade.id);
                              setAddOpen(true);
                            }}
                          >
                            <Plus className="h-4 w-4" />
                            ADD ITEM
                          </button>
                          <button
                            type="button"
                            className="pixel-btn pixel-btn-gold px-4 py-2"
                            disabled={confirmMutation.isPending || myConfirmed}
                            onClick={() => confirmMutation.mutate(trade.id)}
                          >
                            CONFIRM
                          </button>
                          <button
                            type="button"
                            className="pixel-btn pixel-btn-danger px-3 py-2"
                            disabled={cancelMutation.isPending}
                            onClick={() => cancelMutation.mutate(trade.id)}
                          >
                            CANCEL
                          </button>
                          <div className="ml-auto text-sm text-[#91d985]">
                            You: {myConfirmed ? "confirmed" : "open"} · Them:{" "}
                            {theirConfirmed ? "confirmed" : "open"}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </ResponsivePanel>
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="scanlines border-2 border-[#3d9f4b] bg-[#0d2614] text-[#ddf5d9] [&>button]:text-[#91d985] [&>button:hover]:text-[#f7d767]">
          <DialogHeader>
            <DialogTitle className="pixel-heading text-sm text-[#f2fbf1]">
              Add trade offer
            </DialogTitle>
            <DialogDescription className="font-sans text-[#91d985]">
              Changing an offer resets confirmations for both farmers.
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="fruit">
            <TabsList className="grid w-full grid-cols-2 border-2 border-[#153d21] bg-[#0a0f0d]">
              <TabsTrigger
                value="fruit"
                className="font-sans text-[#91d985] data-[state=active]:bg-[#3d9f4b] data-[state=active]:text-[#0a0f0d]"
              >
                Fruit
              </TabsTrigger>
              <TabsTrigger
                value="grow"
                className="font-sans text-[#91d985] data-[state=active]:bg-[#3d9f4b] data-[state=active]:text-[#0a0f0d]"
              >
                $GROW
              </TabsTrigger>
            </TabsList>
            <TabsContent value="fruit" className="space-y-3">
              <Label className="pixel-label">Fruit</Label>
              <Select
                value={selectedFruitId || "none"}
                onValueChange={(value) =>
                  setSelectedFruitId(value === "none" ? "" : value)
                }
              >
                <SelectTrigger className="pixel-input px-3 py-2">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Choose fruit</SelectItem>
                  {(inventory?.fruits || []).map((fruit) => (
                    <SelectItem key={fruit.id} value={fruit.id}>
                      {fruit.fruit.iconUrl} {fruit.mutation.toLowerCase()}{" "}
                      {fruit.fruit.name} x
                      {fruit.quantity - fruit.lockedQuantity}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Label className="pixel-label">Quantity</Label>
              <Input
                type="number"
                min={1}
                className="pixel-input px-3 py-2"
                value={fruitQuantity}
                onChange={(event) =>
                  setFruitQuantity(Number(event.target.value))
                }
              />
              <button
                type="button"
                className="pixel-btn pixel-btn-gold w-full px-4 py-2"
                disabled={
                  !selectedTrade ||
                  !selectedFruitId ||
                  addFruitMutation.isPending
                }
                onClick={() => addFruitMutation.mutate()}
              >
                ADD FRUIT
              </button>
            </TabsContent>
            <TabsContent value="grow" className="space-y-3">
              <Label className="pixel-label">$GROW amount</Label>
              <Input
                type="number"
                min={1}
                className="pixel-input px-3 py-2"
                value={growAmount}
                onChange={(event) => setGrowAmount(Number(event.target.value))}
              />
              <p className="text-sm text-[#91d985]">
                Available: {me?.user.availableGrow ?? 0}
              </p>
              <button
                type="button"
                className="pixel-btn pixel-btn-gold w-full px-4 py-2"
                disabled={!selectedTrade || addGrowMutation.isPending}
                onClick={() => addGrowMutation.mutate()}
              >
                ADD $GROW
              </button>
            </TabsContent>
          </Tabs>
        </DialogContent>
      </Dialog>
    </>
  );
}
