"use client";

import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useWallet } from "@solana/wallet-adapter-react";
import {
  ArrowUpRight,
  Coins,
  Grid3X3,
  Loader2,
  LockOpen,
  RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ProgressionPanel } from "@/components/game/ProgressionPanel";
import { ResponsivePanel } from "@/components/game/overlays/ResponsivePanel";
import { gameEventBus } from "@/lib/game/eventBus";
import {
  decodeGrowfiError,
  useGrowfiActions,
  useGrowfiOnchainState,
} from "@/lib/solana/useGrowfiProgram";
import {
  clientGrowMintFromConfig,
  useWalletBalances,
} from "@/lib/solana/useWalletBalances";
import { apiFetch } from "@/lib/utils/fetcher";
import type { GardenResponse } from "@/types/game-data";

export function FarmUpgradeOverlay({
  open,
  onOpenChange,
  garden,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  garden?: GardenResponse;
}) {
  const queryClient = useQueryClient();
  const { publicKey } = useWallet();
  const growfiActions = useGrowfiActions();
  const onchain = useGrowfiOnchainState(open);
  const [farmProgress, setFarmProgress] = useState("");
  const growMint = clientGrowMintFromConfig(onchain.data?.config);
  const walletBalances = useWalletBalances({
    mintAddress: growMint,
    enabled: open,
  });
  const upgrades = garden?.upgrades;
  const nextLevel = upgrades?.nextLevel;
  const cost = upgrades?.cost ?? 0;
  const balance = walletBalances.data?.grow?.balance ?? 0;
  const missing = Math.max(0, cost - balance);
  const missingPlotCount = useMemo(
    () => onchain.data?.plots.filter((plot) => !plot.account).length ?? 0,
    [onchain.data?.plots]
  );
  const hasEnoughGrow = balance >= cost;
  const canUpgrade =
    !!nextLevel &&
    hasEnoughGrow &&
    !walletBalances.isLoading &&
    missingPlotCount === 0;
  const isDevnetTokenMode =
    process.env.NEXT_PUBLIC_TOKEN_MODE === "devnet" ||
    process.env.NEXT_PUBLIC_TOKEN_CLUSTER === "devnet";

  const mintMutation = useMutation({
    mutationFn: async () => {
      if (!publicKey) {
        throw new Error("Connect your wallet first.");
      }
      return apiFetch<{ signature: string; amount: number }>(
        "/api/devnet/mint-grow",
        {
          method: "POST",
          body: JSON.stringify({ walletAddress: publicKey.toBase58() }),
        }
      );
    },
    onSuccess: async (result) => {
      toast.success("Devnet $GROW minted", {
        description: `${result.amount} $GROW was sent to your wallet.`,
      });
      await queryClient.invalidateQueries({ queryKey: ["wallet-balances"] });
    },
    onError: (err) => {
      toast.error("Mint failed", {
        description: err instanceof Error ? err.message : "Could not mint $GROW.",
      });
    },
  });

  const unlockPlotsMutation = useMutation({
    mutationFn: () => {
      setFarmProgress("Checking farm plots...");
      return growfiActions.ensureFarmPlots({ onProgress: setFarmProgress });
    },
    onSuccess: async (signatures) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["growfi-onchain-state"] }),
        queryClient.invalidateQueries({ queryKey: ["garden"] }),
      ]);
      setFarmProgress("");
      toast.success("Farm plots unlocked", {
        description: signatures.length
          ? `${signatures.length} transaction${signatures.length === 1 ? "" : "s"} confirmed.`
          : "All plots were already ready.",
      });
      gameEventBus.emit("refreshFarmState");
    },
    onError: (err) => {
      setFarmProgress("");
      toast.error("Could not unlock farm plots", {
        description: decodeGrowfiError(err),
      });
    },
  });

  const upgradeMutation = useMutation({
    mutationFn: () => {
      setFarmProgress("Preparing farm upgrade...");
      return growfiActions.upgradeFarm({ onProgress: setFarmProgress });
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["growfi-onchain-state"] }),
        queryClient.invalidateQueries({ queryKey: ["garden"] }),
        queryClient.invalidateQueries({ queryKey: ["wallet-balances"] }),
        queryClient.invalidateQueries({ queryKey: ["me"] }),
        queryClient.invalidateQueries({ queryKey: ["quests"] }),
        queryClient.invalidateQueries({ queryKey: ["tutorial"] }),
      ]);
      setFarmProgress("");
      toast.success("Farm upgraded", {
        description: "New plots were initialized automatically.",
      });
      gameEventBus.emit("refreshFarmState");
    },
    onError: (err) => {
      setFarmProgress("");
      toast.error("Upgrade failed", {
        description: decodeGrowfiError(err),
      });
    },
  });

  return (
    <ResponsivePanel
      open={open}
      onOpenChange={onOpenChange}
      title="Farm Management"
      description="Upgrade your farm size with $GROW from your connected wallet. Existing plants stay where they are."
    >
      <div className="space-y-4">
        <ProgressionPanel garden={garden} />

        <Card className="bg-white/82">
          <CardContent className="space-y-4 p-4">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-md bg-secondary text-primary">
                  <Grid3X3 className="h-5 w-5" />
                </span>
                <div>
                  <div className="font-black">
                    Level {garden?.garden.level ?? 1} Farm
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {garden?.garden.width ?? 4}x{garden?.garden.height ?? 4}{" "}
                    plots
                  </div>
                </div>
              </div>
              <Badge variant="outline">
                {garden?.farmStats?.activePlants ?? 0}/
                {garden?.farmStats?.totalPlots ?? 16} active
              </Badge>
            </div>
            <Progress
              value={
                upgrades
                  ? (upgrades.currentLevel / upgrades.maxLevel) * 100
                  : 20
              }
            />
          </CardContent>
        </Card>

        {farmProgress ? (
          <Alert>
            <Loader2 className="h-4 w-4 animate-spin" />
            <AlertTitle>Working on your farm</AlertTitle>
            <AlertDescription>{farmProgress}</AlertDescription>
          </Alert>
        ) : null}

        {missingPlotCount > 0 ? (
          <Alert>
            <LockOpen className="h-4 w-4" />
            <AlertTitle>Some farm plots need initialization</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>
                Your farm level is upgraded, but {missingPlotCount} plot
                account{missingPlotCount === 1 ? "" : "s"} still need to be
                created on Solana before they can be used.
              </p>
              <Button
                size="sm"
                type="button"
                onClick={() => unlockPlotsMutation.mutate()}
                disabled={unlockPlotsMutation.isPending}
              >
                {unlockPlotsMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <LockOpen className="h-4 w-4" />
                )}
                Unlock Farm Plots
              </Button>
            </AlertDescription>
          </Alert>
        ) : null}

        {nextLevel ? (
          <Card className="bg-white/82">
            <CardContent className="space-y-4 p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase text-leaf-700">
                    Next upgrade
                  </div>
                  <div className="text-xl font-black">
                    Level {nextLevel}: {upgrades?.nextWidth}x
                    {upgrades?.nextHeight}
                  </div>
                </div>
                <Badge
                  variant={canUpgrade ? "common" : "outline"}
                  className="gap-1"
                >
                  <Coins className="h-3.5 w-3.5" />
                  {cost} $GROW
                </Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-md bg-muted p-3">
                  <div className="text-xs font-bold text-muted-foreground">
                    Current Level
                  </div>
                  <div className="text-lg font-black">
                    {upgrades?.currentLevel ?? garden?.garden.level ?? 1}
                  </div>
                </div>
                <div className="rounded-md bg-muted p-3">
                  <div className="text-xs font-bold text-muted-foreground">
                    Upgrade Cost
                  </div>
                  <div className="text-lg font-black">{cost} $GROW</div>
                </div>
                <div className="rounded-md bg-muted p-3">
                  <div className="text-xs font-bold text-muted-foreground">
                    Wallet $GROW Balance
                  </div>
                  <div className="text-lg font-black">
                    {walletBalances.isLoading ? "Checking..." : balance.toLocaleString()}
                  </div>
                </div>
              </div>
              {!hasEnoughGrow ? (
                <Alert>
                  <Coins className="h-4 w-4" />
                  <AlertTitle>Not enough wallet $GROW</AlertTitle>
                  <AlertDescription className="space-y-3">
                    <p>
                      You need {missing.toLocaleString()} more $GROW for this
                      upgrade.
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {isDevnetTokenMode ? (
                        <Button
                          size="sm"
                          type="button"
                          onClick={() => mintMutation.mutate()}
                          disabled={mintMutation.isPending || !publicKey}
                        >
                          {mintMutation.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Coins className="h-4 w-4" />
                          )}
                          Mint Devnet $GROW
                        </Button>
                      ) : null}
                      <Button
                        size="sm"
                        type="button"
                        variant="secondary"
                        onClick={() => walletBalances.refetch()}
                        disabled={walletBalances.isFetching}
                      >
                        <RefreshCw className="h-4 w-4" />
                        Refresh Balance
                      </Button>
                    </div>
                  </AlertDescription>
                </Alert>
              ) : null}
              <Button
                className="w-full"
                disabled={
                  !canUpgrade ||
                  upgradeMutation.isPending ||
                  unlockPlotsMutation.isPending
                }
                onClick={() => upgradeMutation.mutate()}
              >
                {upgradeMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ArrowUpRight className="h-4 w-4" />
                )}
                Upgrade Farm
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Card className="bg-white/82">
            <CardContent className="p-4 font-semibold">
              Your farm is at the current MVP max level.
            </CardContent>
          </Card>
        )}
      </div>
    </ResponsivePanel>
  );
}
