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
    [onchain.data?.plots],
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
        },
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
        description:
          err instanceof Error ? err.message : "Could not mint $GROW.",
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

        <div className="pixel-card space-y-4 p-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="pixel-tile grid h-11 w-11 place-items-center text-[#91d985]">
                <Grid3X3 className="h-5 w-5" />
              </span>
              <div>
                <div className="font-black text-[#f2fbf1]">
                  Level {garden?.garden.level ?? 1} Farm
                </div>
                <div className="text-sm text-[#91d985]">
                  {garden?.garden.width ?? 4}x{garden?.garden.height ?? 4}{" "}
                  plots
                </div>
              </div>
            </div>
            <span className="pixel-badge text-[#91d985]">
              {garden?.farmStats?.activePlants ?? 0}/
              {garden?.farmStats?.totalPlots ?? 16} active
            </span>
          </div>
          <div className="pixel-progress">
            <span
              style={{
                width: `${
                  upgrades
                    ? (upgrades.currentLevel / upgrades.maxLevel) * 100
                    : 20
                }%`,
              }}
            />
          </div>
        </div>

        {farmProgress ? (
          <div className="pixel-card-sunken space-y-2 p-3 text-[#8ad4ff]">
            <div className="flex items-center gap-2 font-bold text-[#f2fbf1]">
              <Loader2 className="h-4 w-4 animate-spin" />
              Working on your farm
            </div>
            <div className="text-sm text-[#91d985]">{farmProgress}</div>
          </div>
        ) : null}

        {missingPlotCount > 0 ? (
          <div className="pixel-card-sunken space-y-3 p-3 text-[#ff9ebd]">
            <div className="flex items-center gap-2 font-bold text-[#f2fbf1]">
              <LockOpen className="h-4 w-4" />
              Some farm plots need initialization
            </div>
            <p className="text-sm text-[#91d985]">
              Your farm level is upgraded, but {missingPlotCount} plot account
              {missingPlotCount === 1 ? "" : "s"} still need to be created on
              Solana before they can be used.
            </p>
            <button
              type="button"
              className="pixel-btn pixel-btn-primary px-3 py-2"
              onClick={() => unlockPlotsMutation.mutate()}
              disabled={unlockPlotsMutation.isPending}
            >
              {unlockPlotsMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <LockOpen className="h-4 w-4" />
              )}
              UNLOCK FARM PLOTS
            </button>
          </div>
        ) : null}

        {nextLevel ? (
          <div className="pixel-card space-y-4 p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="pixel-label">Next upgrade</div>
                <div className="text-xl font-black text-[#f2fbf1]">
                  Level {nextLevel}: {upgrades?.nextWidth}x
                  {upgrades?.nextHeight}
                </div>
              </div>
              <span
                className={`pixel-badge ${
                  canUpgrade ? "text-[#f7d767]" : "text-[#91d985]"
                }`}
              >
                <Coins className="h-3.5 w-3.5" />
                {cost} $GROW
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="pixel-card-sunken p-3">
                <div className="pixel-label">Current Level</div>
                <div className="text-lg font-black text-[#f2fbf1]">
                  {upgrades?.currentLevel ?? garden?.garden.level ?? 1}
                </div>
              </div>
              <div className="pixel-card-sunken p-3">
                <div className="pixel-label">Upgrade Cost</div>
                <div className="text-lg font-black text-[#f7d767]">
                  {cost} $GROW
                </div>
              </div>
              <div className="pixel-card-sunken p-3">
                <div className="pixel-label">Wallet $GROW Balance</div>
                <div className="text-lg font-black text-[#f7d767]">
                  {walletBalances.isLoading
                    ? "Checking..."
                    : balance.toLocaleString()}
                </div>
              </div>
            </div>
            {!hasEnoughGrow ? (
              <div className="pixel-card-sunken space-y-3 p-3 text-[#ff9ebd]">
                <div className="flex items-center gap-2 font-bold text-[#f2fbf1]">
                  <Coins className="h-4 w-4" />
                  Not enough wallet $GROW
                </div>
                <p className="text-sm text-[#91d985]">
                  You need {missing.toLocaleString()} more $GROW for this
                  upgrade.
                </p>
                <div className="flex flex-wrap gap-2">
                  {isDevnetTokenMode ? (
                    <button
                      type="button"
                      className="pixel-btn pixel-btn-gold px-3 py-2"
                      onClick={() => mintMutation.mutate()}
                      disabled={mintMutation.isPending || !publicKey}
                    >
                      {mintMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Coins className="h-4 w-4" />
                      )}
                      MINT DEVNET $GROW
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="pixel-btn pixel-btn-ghost px-3 py-2"
                    onClick={() => walletBalances.refetch()}
                    disabled={walletBalances.isFetching}
                  >
                    <RefreshCw className="h-4 w-4" />
                    REFRESH BALANCE
                  </button>
                </div>
              </div>
            ) : null}
            <button
              type="button"
              className="pixel-btn pixel-btn-primary w-full px-4 py-2"
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
              UPGRADE FARM
            </button>
          </div>
        ) : (
          <div className="pixel-card p-4 font-semibold text-[#91d985]">
            Your farm is at the current MVP max level.
          </div>
        )}
      </div>
    </ResponsivePanel>
  );
}
