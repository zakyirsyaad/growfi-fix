"use client";

import { useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { EmptyState, ErrorState, LoadingState } from "@/components/game/shared/StatusStates";
import { buildDepositTransaction, hasClientTokenConfig } from "@/lib/solana/client";
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

export function WalletDashboard({ compact = false }: { compact?: boolean }) {
  const queryClient = useQueryClient();
  const { connection } = useConnection();
  const wallet = useWallet();
  const [depositAmount, setDepositAmount] = useState(10);
  const [withdrawAmount, setWithdrawAmount] = useState(10);
  const [error, setError] = useState<string | null>(null);

  const { data: me, isLoading: meLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => apiFetch<MeResponse>("/api/me")
  });
  const { data: txs, isLoading: txLoading } = useQuery({
    queryKey: ["transactions"],
    queryFn: () => apiFetch<TransactionsResponse>("/api/wallet/transactions"),
    refetchInterval: 20_000
  });

  const invalidate = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["me"] }),
      queryClient.invalidateQueries({ queryKey: ["transactions"] })
    ]);
  };

  const depositMutation = useMutation({
    mutationFn: async () => {
      if (!wallet.publicKey) {
        throw new Error("Connect a Solana wallet first.");
      }
      let signature = `mock-deposit-${Date.now()}`;
      if (hasClientTokenConfig()) {
        const transaction = await buildDepositTransaction({
          connection,
          wallet: wallet.publicKey,
          amount: depositAmount
        });
        signature = await wallet.sendTransaction(transaction, connection);
        await connection.confirmTransaction(signature, "confirmed");
      }
      return apiFetch("/api/wallet/deposit/verify", {
        method: "POST",
        body: JSON.stringify({ signature, amount: depositAmount })
      });
    },
    onSuccess: async () => {
      setError(null);
      toast.success("Deposit verified");
      await invalidate();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Deposit failed")
  });

  const withdrawMutation = useMutation({
    mutationFn: () =>
      apiFetch("/api/wallet/withdraw", {
        method: "POST",
        body: JSON.stringify({ amount: withdrawAmount })
      }),
    onSuccess: async () => {
      setError(null);
      toast.success("Withdraw completed");
      await invalidate();
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Withdraw failed")
  });

  if (meLoading || !me) {
    return <LoadingState label="Loading wallet" />;
  }

  return (
    <div className="space-y-4">
      {error ? <ErrorState message={error} /> : null}
      {!hasClientTokenConfig() ? (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Mock mode</AlertTitle>
          <AlertDescription>
            Token mint or treasury settings are missing, so deposits credit the hybrid game balance with a mock signature.
          </AlertDescription>
        </Alert>
      ) : null}

      <div className={`grid gap-3 ${compact ? "md:grid-cols-3" : "lg:grid-cols-3"}`}>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base"><Wallet className="h-4 w-4" /> Connected wallet</CardTitle>
            <CardDescription>Solana address bound to Discord</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <WalletMultiButton />
            <div className="break-all rounded-md bg-muted p-3 text-sm font-semibold">
              {wallet.publicKey?.toBase58() || me.user.walletAddress || "No wallet selected"}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">In-game balance</CardTitle>
            <CardDescription>Validated off-chain economy balance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{me.user.availableGrow}</div>
            <div className="text-sm text-muted-foreground">{me.user.lockedGrowBalance} locked in listings/trades</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">On-chain balance</CardTitle>
            <CardDescription>SPL lookup can be expanded after mint setup</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">Devnet</div>
            <div className="text-sm text-muted-foreground">Wallet adapter connected: {wallet.connected ? "yes" : "no"}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="deposit">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="deposit">Deposit</TabsTrigger>
          <TabsTrigger value="withdraw">Withdraw</TabsTrigger>
          <TabsTrigger value="history">History</TabsTrigger>
        </TabsList>
        <TabsContent value="deposit" className="mt-4">
          <Card>
            <CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_auto]">
              <div>
                <Label>Amount</Label>
                <Input type="number" min={1} value={depositAmount} onChange={(event) => setDepositAmount(Number(event.target.value))} />
              </div>
              <div className="flex items-end">
                <Button disabled={depositMutation.isPending || !wallet.publicKey} onClick={() => depositMutation.mutate()}>
                  <ArrowDownToLine className="h-4 w-4" />
                  Deposit $GROW
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="withdraw" className="mt-4">
          <Card>
            <CardContent className="grid gap-3 p-4 sm:grid-cols-[1fr_auto]">
              <div>
                <Label>Amount</Label>
                <Input type="number" min={1} value={withdrawAmount} onChange={(event) => setWithdrawAmount(Number(event.target.value))} />
              </div>
              <div className="flex items-end">
                <Button variant="secondary" disabled={withdrawMutation.isPending || !me.user.walletAddress} onClick={() => withdrawMutation.mutate()}>
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {txs.transactions.map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell className="font-semibold">{tx.type.toLowerCase().replaceAll("_", " ")}</TableCell>
                    <TableCell>{tx.amount}</TableCell>
                    <TableCell>{tx.status.toLowerCase()}</TableCell>
                    <TableCell>{new Date(tx.createdAt).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
