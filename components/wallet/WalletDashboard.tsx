"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDownToLine,
  ArrowUpFromLine,
  Coins,
  ExternalLink,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  EmptyState,
  ErrorState,
  LoadingState,
} from "@/components/game/shared/StatusStates";
import {
  buildDepositTransaction,
  hasClientTokenConfig,
  isClientMockTokenMode,
} from "@/lib/solana/client";
import {
  clientGrowMintFromConfig,
  clientTreasuryVaultFromConfig,
  shortAddress,
  useWalletBalances,
} from "@/lib/solana/useWalletBalances";
import { useGrowfiOnchainState } from "@/lib/solana/useGrowfiProgram";
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

function InfoCard({
  title,
  value,
  description,
  icon: Icon,
}: {
  title: string;
  value: string;
  description?: string;
  icon?: typeof Wallet;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-base">
          {Icon ? <Icon className="h-4 w-4" /> : null}
          {title}
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        <div className="break-words text-2xl font-black">{value}</div>
      </CardContent>
    </Card>
  );
}

export function WalletDashboard({ compact = false }: { compact?: boolean }) {
  const queryClient = useQueryClient();
  const { connection } = useConnection();
  const wallet = useWallet();
  const onchain = useGrowfiOnchainState();
  const mintAddress = clientGrowMintFromConfig(onchain.data?.config);
  const treasuryVault = clientTreasuryVaultFromConfig(onchain.data?.config);
  const balances = useWalletBalances({
    mintAddress,
    enabled: !!wallet.publicKey,
  });
  const [depositAmount, setDepositAmount] = useState(10);
  const [withdrawAmount, setWithdrawAmount] = useState(10);
  const [error, setError] = useState<string | null>(null);

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
      toast.loading("Minting Devnet $GROW", {
        id: "wallet-mint-grow",
        description: "Sending test tokens to your wallet.",
      });
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
      let signature: string;
      if (isClientMockTokenMode()) {
        signature = `mock-deposit-${Date.now()}`;
      } else {
        if (!hasClientTokenConfig()) {
          throw new Error("Token mint and treasury wallet are required for devnet deposits.");
        }
        toast.loading("Preparing deposit", {
          id: "wallet-deposit",
          description: "Waiting for wallet approval.",
        });
        const transaction = await buildDepositTransaction({
          connection,
          wallet: wallet.publicKey,
          amount: depositAmount,
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
        body: JSON.stringify({ signature, amount: depositAmount }),
      });
    },
    onSuccess: async () => {
      setError(null);
      toast.success("Deposit verified", { id: "wallet-deposit" });
      await invalidate();
    },
    onError: (err) => {
      toast.error("Deposit failed", {
        id: "wallet-deposit",
        description: err instanceof Error ? err.message : "Deposit failed.",
      });
      setError(err instanceof Error ? err.message : "Deposit failed");
    },
  });

  const withdrawMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/wallet/withdraw", {
        method: "POST",
        body: JSON.stringify({ amount: withdrawAmount }),
      }),
    onSuccess: async () => {
      setError(null);
      toast.success("Withdraw completed");
      await invalidate();
    },
    onError: (err) =>
      setError(err instanceof Error ? err.message : "Withdraw failed"),
  });

  const walletAddress = wallet.publicKey?.toBase58() || me?.user.walletAddress;
  const solValue = balances.data
    ? `${balances.data.sol.toFixed(4)} SOL`
    : wallet.publicKey
    ? "Loading..."
    : "Connect wallet";
  const growValue = balances.data?.grow
    ? `${balances.data.grow.balance.toLocaleString()} $GROW`
    : mintAddress
    ? "0 $GROW"
    : "Mint not configured";
  const mockMode = isClientMockTokenMode();

  if (meLoading || !me) {
    return <LoadingState label="Loading wallet" />;
  }

  return (
    <div className="space-y-4">
      {error ? <ErrorState message={error} /> : null}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <WalletMultiButton />
        <div className="flex flex-wrap gap-2">
          <Badge variant={mockMode ? "secondary" : "outline"}>
            Mock mode: {mockMode ? "true" : "false/devnet"}
          </Badge>
          <Badge variant="outline">Chain: Devnet</Badge>
          <Button variant="secondary" size="sm" onClick={() => invalidate()}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="deposit">Deposit</TabsTrigger>
          <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4 space-y-4">
          {wallet.publicKey && balances.isLoading ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-28" />
              ))}
            </div>
          ) : (
            <div
              className={`grid gap-3 ${
                compact ? "md:grid-cols-2" : "sm:grid-cols-2 lg:grid-cols-4"
              }`}
            >
              <InfoCard title="Solana Balance" value={solValue} icon={Wallet} />
              <InfoCard
                title="$GROW Token Balance"
                value={growValue}
                icon={Coins}
              />
              <InfoCard title="Connected Chain" value="Devnet" />
              <InfoCard
                title="Connected Wallet"
                value={shortAddress(walletAddress)}
              />
            </div>
          )}

          <div className="grid gap-3 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Program Status</CardTitle>
                <CardDescription>On-chain accounts used by GrowFi</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2 text-sm font-semibold">
                <div className="break-all">Program ID: {process.env.NEXT_PUBLIC_GROWFI_CORE_PROGRAM_ID || "Missing"}</div>
                <div className="break-all">Token Mint: {mintAddress || "Missing"}</div>
                <div className="break-all">Treasury/Vault: {treasuryVault || process.env.NEXT_PUBLIC_TREASURY_WALLET_PUBLIC_KEY || "Missing"}</div>
                <div>Config PDA: {onchain.data?.configPda.toBase58()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Devnet $GROW</CardTitle>
                <CardDescription>Used directly from your connected wallet</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(balances.data?.grow?.balance ?? 0) <= 0 ? (
                  <Alert>
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Insufficient $GROW</AlertTitle>
                    <AlertDescription>
                      Mint test $GROW on devnet to buy seeds and perform
                      on-chain actions.
                    </AlertDescription>
                  </Alert>
                ) : null}
                <Button
                  disabled={!wallet.publicKey || mintMutation.isPending}
                  onClick={() => mintMutation.mutate()}
                >
                  <Coins className="h-4 w-4" />
                  Mint Devnet $GROW
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="deposit" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Deposit</CardTitle>
              <CardDescription>
                $GROW is used directly from your connected wallet for on-chain
                GrowFi actions. Deposit is only needed for legacy indexed
                off-chain flows.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_auto]">
              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  min={1}
                  value={depositAmount}
                  onChange={(event) =>
                    setDepositAmount(Number(event.target.value))
                  }
                />
              </div>
              <div className="flex items-end">
                <Button
                  disabled={depositMutation.isPending || !wallet.publicKey}
                  onClick={() => depositMutation.mutate()}
                >
                  <ArrowDownToLine className="h-4 w-4" />
                  Deposit $GROW
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="withdraw" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Withdraw</CardTitle>
              <CardDescription>
                On-chain-first actions do not create a separate withdrawable
                game balance. Legacy withdraw is available only when the
                off-chain balance has claimable $GROW.
              </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_auto]">
              <div>
                <Label>Amount</Label>
                <Input
                  type="number"
                  min={1}
                  value={withdrawAmount}
                  onChange={(event) =>
                    setWithdrawAmount(Number(event.target.value))
                  }
                />
              </div>
              <div className="flex items-end">
                <Button
                  variant="secondary"
                  disabled={withdrawMutation.isPending || !me.user.walletAddress}
                  onClick={() => withdrawMutation.mutate()}
                >
                  <ArrowUpFromLine className="h-4 w-4" />
                  Withdraw $GROW
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          {txLoading ? (
            <LoadingState label="Loading transactions" />
          ) : !txs?.transactions.length ? (
            <EmptyState title="No transactions yet" />
          ) : (
            <>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Tx</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {txs.transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell className="font-semibold">
                          {tx.type.toLowerCase().replaceAll("_", " ")}
                        </TableCell>
                        <TableCell>{tx.amount}</TableCell>
                        <TableCell>{tx.status.toLowerCase()}</TableCell>
                        <TableCell>
                          {new Date(tx.createdAt).toLocaleString()}
                        </TableCell>
                        <TableCell>
                          {tx.signature ? (
                            <Button variant="ghost" size="sm" asChild>
                              <a
                                href={explorerLink(tx.signature)}
                                target="_blank"
                                rel="noreferrer"
                              >
                                <ExternalLink className="h-4 w-4" />
                                Explorer
                              </a>
                            </Button>
                          ) : (
                            "local"
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              <div className="grid gap-3 md:hidden">
                {txs.transactions.map((tx) => (
                  <Card key={tx.id}>
                    <CardContent className="space-y-2 p-4">
                      <div className="flex items-center justify-between gap-2">
                        <div className="font-bold">
                          {tx.type.toLowerCase().replaceAll("_", " ")}
                        </div>
                        <Badge variant="outline">{tx.status.toLowerCase()}</Badge>
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {tx.amount} $GROW ·{" "}
                        {new Date(tx.createdAt).toLocaleString()}
                      </div>
                      {tx.signature ? (
                        <Button variant="secondary" size="sm" asChild>
                          <a
                            href={explorerLink(tx.signature)}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <ExternalLink className="h-4 w-4" />
                            Explorer
                          </a>
                        </Button>
                      ) : null}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
