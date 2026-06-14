"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Wallet,
  ArrowDownToLine,
  ArrowUpFromLine,
  ArrowRightLeft,
  ExternalLink,
  ReceiptText,
  Server,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  buildDepositTransaction,
  hasClientTokenConfig,
  isClientMockTokenMode,
} from "@/lib/solana/client";
import {
  clientGrowMintFromConfig,
  shortAddress,
  useWalletBalances,
} from "@/lib/solana/useWalletBalances";
import {
  decodeGrowfiError,
  useGrowfiActions,
  useGrowfiOnchainState,
} from "@/lib/solana/useGrowfiProgram";
import { getGrowfiCoreProgramId } from "@/lib/solana/growfiCore";
import { apiFetch } from "@/lib/utils/fetcher";

type MeResponse = {
  user: {
    walletAddress?: string | null;
    growBalance: number;
    lockedGrowBalance: number;
    availableGrow: number;
  };
};

type TransactionView = {
  id: string;
  type: string;
  amount: number;
  status: string;
  signature?: string | null;
  createdAt: string;
};

type TransactionsResponse = { transactions: TransactionView[] };
type MintResponse = { signature: string; amount: number; explorerUrl: string };

function explorerLink(signature: string) {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

export function WalletDashboard({ compact = false }: { compact?: boolean }) {
  const queryClient = useQueryClient();
  const { connection } = useConnection();
  const wallet = useWallet();
  const onchain = useGrowfiOnchainState();
  const mintAddress = clientGrowMintFromConfig(onchain.data?.config);
  const balances = useWalletBalances({
    mintAddress,
    enabled: !!wallet.publicKey,
  });
  const [depositAmount, setDepositAmount] = useState<number | "">("");
  const [withdrawAmount, setWithdrawAmount] = useState<number | "">("");
  const [activeTab, setActiveTab] = useState<"ALL" | "DEPOSIT" | "WITHDRAW">(
    "ALL",
  );

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<MeResponse>("/api/me"),
  });
  const { data: txs, isLoading: txLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => apiFetch<TransactionsResponse>("/api/wallet/transactions"),
    refetchInterval: 20_000,
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["me"] }),
      queryClient.invalidateQueries({ queryKey: ["transactions"] }),
      queryClient.invalidateQueries({ queryKey: ["activity"] }),
      queryClient.invalidateQueries({ queryKey: ["growfi-onchain-state"] }),
      balances.refetch(),
    ]);
  };

  const mintMutation = useMutation({
    mutationFn: async () => {
      if (!wallet.publicKey) {
        throw new Error("Connect a Solana wallet first.");
      }
      return apiFetch<MintResponse>("/api/devnet/mint-grow", {
        method: "POST",
        body: JSON.stringify({ walletAddress: wallet.publicKey.toBase58() }),
      });
    },
    onMutate: () => {
      toast.loading("Minting Devnet $GROW", { id: "wallet-mint-grow" });
    },
    onSuccess: async (result) => {
      toast.success("Devnet $GROW minted", {
        id: "wallet-mint-grow",
        description: `${result.amount} $GROW received.`,
        action: {
          label: "Explorer",
          onClick: () => window.open(result.explorerUrl, "_blank"),
        },
      });
      await invalidate();
    },
    onError: (err) => {
      toast.error("Mint failed", {
        id: "wallet-mint-grow",
        description:
          err instanceof Error ? err.message : "Use the manual mint fallback.",
      });
    },
  });

  const depositMutation = useMutation({
    mutationFn: async () => {
      if (!wallet.publicKey) {
        throw new Error("Connect a Solana wallet first.");
      }
      if (!depositAmount || Number(depositAmount) <= 0) {
        throw new Error("Please enter a valid deposit amount.");
      }

      let signature: string;
      if (isClientMockTokenMode()) {
        signature = `mock-deposit-${Date.now()}`;
      } else {
        if (!hasClientTokenConfig()) {
          throw new Error(
            "Token mint and treasury wallet are required for devnet deposits.",
          );
        }
        toast.loading("Preparing deposit", { id: "wallet-deposit" });
        const transaction = await buildDepositTransaction({
          connection,
          wallet: wallet.publicKey,
          amount: Number(depositAmount),
        });
        signature = await wallet.sendTransaction(transaction, connection);
        toast.loading("Confirming deposit", {
          id: "wallet-deposit",
          description: shortAddress(signature),
        });
        await connection.confirmTransaction(signature, "confirmed");
      }
      return apiFetch("/api/wallet/deposit/verify", {
        method: "POST",
        body: JSON.stringify({ signature, amount: Number(depositAmount) }),
      });
    },
    onSuccess: async () => {
      toast.success("Deposit verified", { id: "wallet-deposit" });
      setDepositAmount("");
      await invalidate();
    },
    onError: (err) => {
      toast.error("Deposit failed", {
        id: "wallet-deposit",
        description: err instanceof Error ? err.message : "Deposit failed.",
      });
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: async () => {
      if (!withdrawAmount || Number(withdrawAmount) <= 0) {
        throw new Error("Please enter a valid withdrawal amount.");
      }
      return apiFetch("/api/wallet/withdraw", {
        method: "POST",
        body: JSON.stringify({ amount: Number(withdrawAmount) }),
      });
    },
    onSuccess: async () => {
      toast.success("Withdraw completed");
      setWithdrawAmount("");
      await invalidate();
    },
    onError: (err) =>
      toast.error(err instanceof Error ? err.message : "Withdraw failed"),
  });

  const filteredTxs = useMemo(() => {
    if (!txs?.transactions) return [];
    if (activeTab === "ALL") return txs.transactions;
    return txs.transactions.filter((t) => t.type === activeTab);
  }, [txs, activeTab]);

  const growValueNum = balances.data?.grow?.balance ?? 0;
  const growValueFormatted = growValueNum.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  return (
    <div className="space-y-4 font-sans text-foreground">
      {!compact && (
        <div className="flex flex-wrap items-center justify-between gap-2 mb-6">
          <WalletMultiButton className="!bg-primary !text-primary-foreground !rounded-lg !h-auto !py-2.5 !px-6 font-bold" />
          <div className="flex gap-4">
            <Button
              variant="outline"
              onClick={() => mintMutation.mutate()}
              disabled={mintMutation.isPending || !wallet.publicKey}
              className="text-primary font-semibold"
            >
              Mint Devnet $GROW
            </Button>
          </div>
        </div>
      )}

      {/* Balance Section */}
      <div
        className={`grid grid-cols-1 ${compact ? "" : "lg:grid-cols-3"} gap-6 mb-8`}
      >
        {/* Main Balance Card */}
        <Card
          className={`${compact ? "" : "lg:col-span-2"} bg-card/60 backdrop-blur-md border-border/50 rounded-2xl p-6 flex flex-col justify-between ${compact ? "min-h-[160px]" : "min-h-[240px]"} shadow-sm relative overflow-hidden group`}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
          {meLoading || balances.isLoading ? (
            <div className="animate-pulse space-y-4">
              <div className="h-6 w-32 bg-muted rounded"></div>
              <div className="h-16 w-64 bg-muted rounded"></div>
            </div>
          ) : (
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-4">
                <span className="text-xs text-muted-foreground font-bold tracking-widest uppercase">
                  $GROW BALANCE
                </span>
                <Wallet className="text-primary/50 w-6 h-6" />
              </div>
              <div className="flex items-baseline gap-3">
                <span
                  className={`${compact ? "text-4xl" : "text-5xl"} leading-none text-foreground font-black tracking-tight`}
                >
                  {growValueFormatted}
                </span>
                <span className="text-xl text-primary font-bold">$GROW</span>
              </div>
            </div>
          )}

          <div
            className={`flex flex-wrap items-center gap-4 ${compact ? "mt-4" : "mt-8"} relative z-10`}
          >
            {/* Deposit Input & Button */}
            <div className="flex items-center bg-muted/50 border border-border rounded-xl overflow-hidden focus-within:border-primary/50 transition-colors">
              <Input
                type="number"
                placeholder="0"
                min="1"
                value={depositAmount}
                onChange={(e) =>
                  setDepositAmount(e.target.value ? Number(e.target.value) : "")
                }
                className="bg-transparent w-24 border-0 focus-visible:ring-0 px-4 py-2 font-bold text-sm"
              />
              <Button
                variant="ghost"
                onClick={() => depositMutation.mutate()}
                disabled={depositMutation.isPending || !depositAmount}
                className="text-primary font-bold hover:bg-primary/20 hover:text-primary rounded-none rounded-r-xl"
              >
                <ArrowDownToLine className="w-4 h-4 mr-2" />
                Deposit
              </Button>
            </div>

            {/* Withdraw Input & Button */}
            <div className="flex items-center bg-muted/50 border border-border rounded-xl overflow-hidden focus-within:border-accent/50 transition-colors">
              <Input
                type="number"
                placeholder="0"
                min="1"
                value={withdrawAmount}
                onChange={(e) =>
                  setWithdrawAmount(
                    e.target.value ? Number(e.target.value) : "",
                  )
                }
                className="bg-transparent w-24 border-0 focus-visible:ring-0 px-4 py-2 font-bold text-sm"
              />
              <Button
                variant="ghost"
                onClick={() => withdrawMutation.mutate()}
                disabled={withdrawMutation.isPending || !withdrawAmount}
                className="text-accent font-bold hover:bg-accent/20 hover:text-accent rounded-none rounded-r-xl"
              >
                <ArrowUpFromLine className="w-4 h-4 mr-2" />
                Withdraw
              </Button>
            </div>
          </div>
        </Card>

        {/* Connection/Status Card */}
        {!compact && (
          <Card className="bg-card/60 backdrop-blur-md border-border/50 rounded-2xl p-6 flex flex-col gap-6 shadow-sm">
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              <Server className="w-5 h-5 text-primary" /> Network Status
            </h3>

            <div className="space-y-4">
              <div className="flex justify-between items-center pb-4 border-b border-border/30">
                <span className="text-sm font-medium text-muted-foreground">
                  Cluster
                </span>
                <span className="text-sm text-primary font-bold">Devnet</span>
              </div>
              <div className="flex justify-between items-center pb-4 border-b border-border/30">
                <span className="text-sm font-medium text-muted-foreground">
                  Program ID
                </span>
                <span className="text-sm font-mono text-foreground truncate max-w-[120px]">
                  {shortAddress(getGrowfiCoreProgramId().toBase58())}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-muted-foreground">
                  Mock Token Mode
                </span>
                <span className="text-sm font-bold text-foreground">
                  {isClientMockTokenMode() ? "Enabled" : "Disabled"}
                </span>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Transaction History Table */}
      {!compact && (
        <Card className="bg-card/60 backdrop-blur-md border-border/50 rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-6 border-b border-border/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <h2 className="text-xl font-bold text-foreground">
              Transaction History
            </h2>

            <div className="flex bg-muted/50 p-1 rounded-xl border border-border/30">
              {(["ALL", "DEPOSIT", "WITHDRAW"] as const).map((tab) => (
                <Button
                  variant="ghost"
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`relative rounded-lg text-xs font-bold z-10 hover:bg-transparent ${activeTab === tab ? "text-foreground" : "text-muted-foreground hover:text-foreground"}`}
                >
                  {activeTab === tab && (
                    <motion.div
                      layoutId="wallet-tab"
                      className="absolute inset-0 bg-card border border-border/50 rounded-lg shadow-sm -z-10"
                      transition={{
                        type: "spring",
                        stiffness: 300,
                        damping: 30,
                      }}
                    />
                  )}
                  {tab === "ALL"
                    ? "All"
                    : tab === "DEPOSIT"
                      ? "Deposits"
                      : "Withdrawals"}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Table>
              <TableHeader className="bg-muted/20 border-b border-border/30">
                <TableRow>
                  <TableHead className="px-6 py-4 text-xs font-bold text-muted-foreground tracking-wider uppercase">
                    Type
                  </TableHead>
                  <TableHead className="px-6 py-4 text-xs font-bold text-muted-foreground tracking-wider uppercase text-right">
                    Amount
                  </TableHead>
                  <TableHead className="px-6 py-4 text-xs font-bold text-muted-foreground tracking-wider uppercase">
                    Status
                  </TableHead>
                  <TableHead className="px-6 py-4 text-xs font-bold text-muted-foreground tracking-wider uppercase text-right">
                    Date
                  </TableHead>
                  <TableHead className="px-6 py-4 text-xs font-bold text-muted-foreground tracking-wider uppercase">
                    Tx
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="divide-y divide-border/30">
                {txLoading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <TableRow key={i} className="animate-pulse">
                      <TableCell className="px-6 py-5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-muted"></div>
                          <div className="h-4 w-20 bg-muted rounded"></div>
                        </div>
                      </TableCell>
                      <TableCell className="px-6 py-5 text-right">
                        <div className="h-4 w-24 bg-muted rounded ml-auto"></div>
                      </TableCell>
                      <TableCell className="px-6 py-5">
                        <div className="h-4 w-16 bg-muted rounded"></div>
                      </TableCell>
                      <TableCell className="px-6 py-5 text-right">
                        <div className="h-4 w-24 bg-muted rounded ml-auto"></div>
                      </TableCell>
                      <TableCell className="px-6 py-5">
                        <div className="h-4 w-8 bg-muted rounded"></div>
                      </TableCell>
                    </TableRow>
                  ))
                ) : !filteredTxs.length ? (
                  <TableRow>
                    <TableCell colSpan={5} className="px-6 py-16 text-center">
                      <div className="flex flex-col items-center gap-3">
                        <ReceiptText className="w-10 h-10 text-muted-foreground/50" />
                        <p className="text-muted-foreground text-sm">
                          No{" "}
                          {activeTab !== "ALL" ? activeTab.toLowerCase() : ""}{" "}
                          transactions found.
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  <AnimatePresence mode="popLayout">
                    {filteredTxs.map((tx) => (
                      <motion.tr
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        key={tx.id}
                        className="hover:bg-muted/10 transition-colors group"
                      >
                        <TableCell className="px-6 py-5">
                          <div className="flex items-center gap-3">
                            {tx.type === "DEPOSIT" ? (
                              <div className="text-primary bg-primary/10 border border-primary/20 p-2 rounded-xl">
                                <ArrowDownToLine className="w-5 h-5" />
                              </div>
                            ) : tx.type === "WITHDRAW" ? (
                              <div className="text-accent bg-accent/10 border border-accent/20 p-2 rounded-xl">
                                <ArrowUpFromLine className="w-5 h-5" />
                              </div>
                            ) : (
                              <div className="text-muted-foreground bg-muted border border-border/50 p-2 rounded-xl">
                                <ArrowRightLeft className="w-5 h-5" />
                              </div>
                            )}
                            <span className="text-sm font-bold capitalize text-foreground">
                              {tx.type.toLowerCase()}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell
                          className={`px-6 py-5 text-right font-black text-lg ${tx.type === "DEPOSIT" ? "text-primary" : "text-foreground"}`}
                        >
                          {tx.type === "DEPOSIT" ? "+" : "-"}
                          {tx.amount}{" "}
                          <span className="text-sm text-muted-foreground font-semibold">
                            $GROW
                          </span>
                        </TableCell>
                        <TableCell className="px-6 py-5">
                          <span
                            className={`px-3 py-1 rounded-md text-xs font-bold border ${
                              tx.status === "FAILED"
                                ? "bg-destructive/10 text-destructive border-destructive/20"
                                : tx.status === "PENDING"
                                  ? "bg-gold-100 text-gold-700 border-gold-300"
                                  : "bg-primary/10 text-primary border-primary/20"
                            }`}
                          >
                            {tx.status.toLowerCase()}
                          </span>
                        </TableCell>
                        <TableCell className="px-6 py-5 text-right text-xs font-medium text-muted-foreground">
                          {new Date(tx.createdAt).toLocaleDateString()}
                        </TableCell>
                        <TableCell className="px-6 py-5">
                          {tx.signature ? (
                            <a
                              href={explorerLink(tx.signature)}
                              target="_blank"
                              rel="noreferrer"
                              className="text-primary hover:text-primary/80 transition-colors hover:underline text-sm font-bold flex items-center gap-1"
                            >
                              Link <ExternalLink className="w-3 h-3" />
                            </a>
                          ) : (
                            <span className="text-muted-foreground bg-muted px-2 py-1 rounded-md text-xs font-bold">
                              Local
                            </span>
                          )}
                        </TableCell>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                )}
              </TableBody>
            </Table>
          </div>
        </Card>
      )}
    </div>
  );
}
