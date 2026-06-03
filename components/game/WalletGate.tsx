"use client";

import { ReactNode, useEffect, useMemo, useState, useRef } from "react";
import { signIn, useSession } from "next-auth/react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useWallet, type WalletContextState } from "@solana/wallet-adapter-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Coins,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { gameEventBus } from "@/lib/game/eventBus";
import { apiFetch } from "@/lib/utils/fetcher";
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
import { connectVerifiedWallet } from "@/lib/solana/verifiedWalletConnect";

const MINIMUM_DEVNET_SOL = 0.05;

type MintResponse = {
  signature: string;
  amount: number;
  explorerUrl: string;
};

function explorerLink(signature: string) {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

function isDevnetConfigured() {
  const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || "";
  const rpcLooksDevnet =
    !rpcUrl ||
    rpcUrl.includes("devnet") ||
    rpcUrl.includes("localhost") ||
    rpcUrl.includes("127.0.0.1");
  return (
    rpcLooksDevnet &&
    (process.env.NEXT_PUBLIC_TOKEN_CLUSTER || "devnet") === "devnet" &&
    (process.env.NEXT_PUBLIC_TOKEN_MODE || "devnet") === "devnet"
  );
}

function SetupStep({
  index,
  label,
  complete,
  active,
}: {
  index: number;
  label: string;
  complete: boolean;
  active: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-md border px-3 py-2 text-sm font-semibold ${
        active ? "border-primary bg-primary/10" : "bg-white/72"
      }`}
    >
      <span
        className={`grid h-7 w-7 place-items-center rounded-md text-xs font-black ${
          complete ? "bg-leaf-700 text-white" : "bg-muted"
        }`}
      >
        {complete ? <CheckCircle2 className="h-4 w-4" /> : index}
      </span>
      <span className="min-w-0 flex-1">{label}</span>
    </div>
  );
}

function ManualGrowInstructions({
  walletAddress,
  mintAddress,
}: {
  walletAddress?: string;
  mintAddress?: string | null;
}) {
  const mint = mintAddress || process.env.NEXT_PUBLIC_GROW_TOKEN_MINT || "GROW_TOKEN_MINT";
  return (
    <div className="rounded-md bg-muted p-3 text-xs font-semibold text-muted-foreground">
      <div className="mb-1 text-foreground">CLI fallback</div>
      <pre className="whitespace-pre-wrap break-words">
        {`spl-token create-account ${mint}
spl-token mint ${mint} 1000000 ${walletAddress || "USER_WALLET_ADDRESS"}`}
      </pre>
    </div>
  );
}

export function WalletGate({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession();
  const wallet = useWallet();
  const queryClient = useQueryClient();
  const onchain = useGrowfiOnchainState(status === "authenticated");
  const growfiActions = useGrowfiActions();
  const mintAddress = clientGrowMintFromConfig(onchain.data?.config);
  const balances = useWalletBalances({
    mintAddress,
    enabled: status === "authenticated" && !!wallet.publicKey,
  });
  const [farmProgress, setFarmProgress] = useState("");
  const meQuery = useQuery({
    queryKey: ["me"],
    queryFn: () =>
      apiFetch<{ user: { id: string; walletAddress?: string | null } }>("/api/me"),
    enabled: status === "authenticated",
  });

  const walletAddress = wallet.publicKey?.toBase58();
  const solBalance = balances.data?.sol ?? 0;
  const growBalance = balances.data?.grow?.balance ?? 0;
  const hasDevnetSol = solBalance >= MINIMUM_DEVNET_SOL;
  const hasGrow = !!mintAddress && growBalance > 0;
  const devnetConfigured = isDevnetConfigured();
  const ready =
    status === "authenticated" &&
    !!wallet.publicKey &&
    devnetConfigured &&
    !!onchain.data?.config &&
    hasDevnetSol &&
    hasGrow &&
    !!onchain.data?.player &&
    !!onchain.data?.farm;

  useEffect(() => {
    gameEventBus.emit("gameInputLockChanged", {
      source: "wallet-gate",
      locked: !ready,
    });
    return () => {
      gameEventBus.emit("gameInputLockChanged", {
        source: "wallet-gate",
        locked: false,
      });
    };
  }, [ready]);

  const walletVerified =
    !!wallet.publicKey &&
    !!walletAddress &&
    meQuery.data?.user.walletAddress === walletAddress;

  const verifyWalletMutation = useMutation({
    mutationFn: () => connectVerifiedWallet(wallet as unknown as WalletContextState),
    onSuccess: async () => {
      toast.success("Wallet verified");
      await queryClient.invalidateQueries({ queryKey: ["me"] });
    },
    onError: (error) => {
      toast.error("Wallet verification failed", {
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    },
  });

  const refreshAll = async () => {
    await Promise.all([
      onchain.refetch(),
      balances.refetch(),
      queryClient.invalidateQueries({ queryKey: ["me"] }),
      queryClient.invalidateQueries({ queryKey: ["garden"] }),
      queryClient.invalidateQueries({ queryKey: ["inventory"] }),
    ]);
  };

  const mintMutation = useMutation({
    mutationFn: async () => {
      if (!walletAddress) {
        throw new Error("Connect a wallet first.");
      }
      return apiFetch<MintResponse>("/api/devnet/mint-grow", {
        method: "POST",
        body: JSON.stringify({ walletAddress }),
      });
    },
    onMutate: () => {
      toast.loading("Minting Devnet $GROW", {
        id: "mint-grow",
        description: "Creating your token account if needed.",
      });
    },
    onSuccess: async (result) => {
      toast.success("Devnet $GROW minted", {
        id: "mint-grow",
        description: `${result.amount} $GROW sent to ${shortAddress(
          walletAddress
        )}`,
        action: {
          label: "Explorer",
          onClick: () => window.open(result.explorerUrl, "_blank"),
        },
      });
      await refreshAll();
    },
    onError: (error) => {
      toast.error("Could not mint Devnet $GROW", {
        id: "mint-grow",
        description:
          error instanceof Error
            ? error.message
            : "Use the manual SPL Token commands below.",
      });
    },
  });

  const createPlayerMutation = useMutation({
    mutationFn: () => {
      if (!hasDevnetSol) {
        throw new Error(
          "Your wallet has no Devnet SOL. Please get Devnet SOL first."
        );
      }
      return growfiActions.createPlayer();
    },
    onSuccess: async (signature) => {
      toast.success("Player created", {
        description: signature ? shortAddress(signature) : undefined,
        action: signature
          ? {
              label: "Explorer",
              onClick: () => window.open(explorerLink(signature), "_blank"),
            }
          : undefined,
      });
      await refreshAll();
    },
    onError: (error) => {
      toast.error("Create player failed", {
        description: decodeGrowfiError(error),
      });
    },
  });

  const createFarmMutation = useMutation({
    mutationFn: () => {
      if (!hasDevnetSol) {
        throw new Error(
          "Your wallet has no Devnet SOL. Please get Devnet SOL first."
        );
      }
      setFarmProgress("Preparing farm transaction...");
      return growfiActions.createFarmWithInitialPlots({
        onProgress: setFarmProgress,
      });
    },
    onSuccess: async () => {
      setFarmProgress("");
      toast.success("Farm initialized", {
        description: "Your first plots are ready.",
      });
      await refreshAll();
    },
    onError: (error) => {
      setFarmProgress("");
      toast.error("Create farm failed", {
        description: decodeGrowfiError(error),
      });
    },
  });

  const loading =
    status === "loading" ||
    (status === "authenticated" && onchain.isLoading) ||
    (!!wallet.publicKey && balances.isLoading);

  const steps = useMemo(
    () => [
      { label: "Login with Discord", complete: status === "authenticated" },
      { label: "Connect Solana Wallet", complete: walletVerified },
      { label: "Check Devnet SOL", complete: !!wallet.publicKey && hasDevnetSol },
      { label: "Check or Mint Devnet $GROW", complete: hasGrow },
      { label: "Create On-chain Player", complete: !!onchain.data?.player },
      { label: "Create/Initialize Farm", complete: !!onchain.data?.farm },
      { label: "Enter Game", complete: ready },
    ],
    [
      hasDevnetSol,
      hasGrow,
      onchain.data?.farm,
      onchain.data?.player,
      ready,
      status,
      wallet.publicKey,
    ]
  );
  const activeStep =
    steps.findIndex((step) => !step.complete) === -1
      ? steps.length - 1
      : steps.findIndex((step) => !step.complete);

  if (ready) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-[100svh] bg-leaf-500 p-4 text-leaf-950 md:p-6">
      <div className="mx-auto grid min-h-[calc(100svh-2rem)] max-w-6xl items-center gap-4 lg:grid-cols-[380px_minmax(0,1fr)]">
        <Card className="bg-white/92 shadow-xl backdrop-blur">
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle>GrowFi Setup</CardTitle>
              <Badge variant="outline" className="bg-white">
                Devnet
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {steps.map((step, index) => (
              <SetupStep
                key={step.label}
                index={index + 1}
                label={step.label}
                complete={step.complete}
                active={activeStep === index}
              />
            ))}
          </CardContent>
        </Card>

        <Card className="bg-white/94 shadow-xl backdrop-blur">
          <CardHeader>
            <CardTitle>
              {status !== "authenticated"
                ? "Login with Discord"
                : !wallet.publicKey
                ? "Connect Solana Wallet"
                : !devnetConfigured || !onchain.data?.config
                ? "Devnet Configuration"
                : !hasDevnetSol
                ? "Get Devnet SOL"
                : !hasGrow
                ? "Mint Devnet $GROW"
                : !onchain.data?.player
                ? "Create Your On-chain Player"
                : "Create Your Farm"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-5 w-2/3" />
                <Skeleton className="h-20 w-full" />
                <Skeleton className="h-10 w-48" />
              </div>
            ) : status !== "authenticated" ? (
              <>
                <p className="text-sm font-semibold text-muted-foreground">
                  Your farm profile, inventory cache, and social identity start
                  with Discord.
                </p>
                <Button onClick={() => signIn("discord")}>
                  Login with Discord
                </Button>
              </>
            ) : !walletVerified ? (
              <>
                <p className="text-sm font-semibold text-muted-foreground">
                  Connect and verify a Solana wallet so GrowFi can find your on-chain
                  player, farm, and $GROW token account.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <WalletMultiButton />
                  <Button
                    disabled={!walletAddress || verifyWalletMutation.isPending}
                    onClick={() => verifyWalletMutation.mutate()}
                  >
                    {verifyWalletMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Wallet className="h-4 w-4" />
                    )}
                    Verify wallet
                  </Button>
                </div>
              </>
            ) : !devnetConfigured ? (
              <Alert variant="destructive">
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>Wrong cluster configured</AlertTitle>
                <AlertDescription>
                  Set NEXT_PUBLIC_TOKEN_CLUSTER=devnet and
                  NEXT_PUBLIC_TOKEN_MODE=devnet, and point
                  NEXT_PUBLIC_SOLANA_RPC_URL at devnet before entering the game.
                </AlertDescription>
              </Alert>
            ) : !onchain.data?.config ? (
              <Alert>
                <ShieldAlert className="h-4 w-4" />
                <AlertTitle>GrowFi program config is missing</AlertTitle>
                <AlertDescription>
                  The connected devnet program has no Config PDA yet. Run the
                  Anchor initialize-config script with the devnet admin wallet.
                </AlertDescription>
              </Alert>
            ) : !hasDevnetSol ? (
              <>
                <Alert>
                  <Wallet className="h-4 w-4" />
                  <AlertTitle>You need Devnet SOL to pay transaction fees.</AlertTitle>
                  <AlertDescription>
                    Current balance: {solBalance.toFixed(4)} SOL. Add Devnet
                    SOL before creating your on-chain player.
                  </AlertDescription>
                </Alert>
                <div className="flex flex-wrap gap-2">
                  <Button asChild>
                    <a
                      href="https://faucet.solana.com/"
                      target="_blank"
                      rel="noreferrer"
                    >
                      <ExternalLink className="h-4 w-4" />
                      Open Solana Faucet
                    </a>
                  </Button>
                  <Button variant="secondary" onClick={() => balances.refetch()}>
                    <RefreshCw className="h-4 w-4" />
                    Refresh Balance
                  </Button>
                </div>
                <div className="rounded-md bg-muted p-3 text-xs font-semibold text-muted-foreground">
                  solana airdrop 2 {walletAddress} --url devnet
                </div>
              </>
            ) : !hasGrow ? (
              <>
                <Alert>
                  <Coins className="h-4 w-4" />
                  <AlertTitle>You do not have Devnet $GROW yet.</AlertTitle>
                  <AlertDescription>
                    Mint test $GROW to your connected wallet. This button only
                    works in devnet mode when the server has a mint authority.
                  </AlertDescription>
                </Alert>
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={mintMutation.isPending || !mintAddress}
                    onClick={() => mintMutation.mutate()}
                  >
                    {mintMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Coins className="h-4 w-4" />
                    )}
                    Mint Devnet $GROW
                  </Button>
                  <Button variant="secondary" onClick={() => balances.refetch()}>
                    <RefreshCw className="h-4 w-4" />
                    Refresh Balance
                  </Button>
                </div>
                <ManualGrowInstructions
                  walletAddress={walletAddress}
                  mintAddress={mintAddress}
                />
              </>
            ) : !onchain.data?.player ? (
              <>
                <Alert>
                  <Wallet className="h-4 w-4" />
                  <AlertTitle>Create Your On-chain Player</AlertTitle>
                  <AlertDescription>
                    This creates your GrowFi player account on Solana devnet.
                    You will approve one wallet transaction.
                  </AlertDescription>
                </Alert>
                <div className="grid gap-2 rounded-md bg-muted p-3 text-sm font-semibold">
                  <div>Wallet: {shortAddress(walletAddress)}</div>
                  <div>Devnet SOL: {solBalance.toFixed(4)}</div>
                  <div>Requirement: enough Devnet SOL for account rent and fees.</div>
                </div>
                <Button
                  className="w-full"
                  disabled={createPlayerMutation.isPending || !hasDevnetSol}
                  onClick={() => createPlayerMutation.mutate()}
                >
                  {createPlayerMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Create Player
                </Button>
              </>
            ) : (
              <>
                <Alert>
                  <Wallet className="h-4 w-4" />
                  <AlertTitle>Create/Initialize Farm</AlertTitle>
                  <AlertDescription>
                    This creates your farm and first 4x4 plots in a smooth
                    batched flow. Your wallet may ask for a few approvals
                    depending on transaction size.
                  </AlertDescription>
                </Alert>
                {farmProgress ? (
                  <div className="rounded-md bg-muted p-3 text-sm font-semibold">
                    {farmProgress}
                  </div>
                ) : null}
                <Button
                  className="w-full"
                  disabled={createFarmMutation.isPending || !hasDevnetSol}
                  onClick={() => createFarmMutation.mutate()}
                >
                  {createFarmMutation.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : null}
                  Create Farm
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
