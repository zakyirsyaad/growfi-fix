"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import { signIn, useSession } from "next-auth/react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import {
  useWallet,
  type WalletContextState,
} from "@solana/wallet-adapter-react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import {
  CheckCircle2,
  Coins,
  ExternalLink,
  Loader2,
  RefreshCw,
  ShieldAlert,
  Wallet,
  Leaf,
  ChevronRight
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
      className={`group flex items-center gap-4 rounded-xl border p-4 transition-all duration-300 ${
        active 
          ? "border-primary bg-primary/5 shadow-sm scale-[1.02]" 
          : complete
            ? "border-border/50 bg-card/50 opacity-70"
            : "border-border bg-card/50 opacity-40"
      }`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-black shadow-sm transition-colors ${
          complete 
            ? "bg-primary text-primary-foreground" 
            : active
              ? "bg-primary/20 text-primary border border-primary/30"
              : "bg-muted text-muted-foreground border border-border"
        }`}
      >
        {complete ? <CheckCircle2 className="h-5 w-5" /> : index}
      </div>
      <span className={`min-w-0 flex-1 font-bold text-sm ${active ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
      {active && <ChevronRight className="h-5 w-5 text-primary animate-pulse" />}
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
  const mint =
    mintAddress || process.env.NEXT_PUBLIC_GROW_TOKEN_MINT || "GROW_TOKEN_MINT";
  return (
    <div className="rounded-xl border border-border bg-muted/50 p-4 text-xs font-mono text-muted-foreground shadow-inner">
      <div className="mb-2 text-foreground font-bold font-sans uppercase tracking-wider text-[10px]">CLI fallback</div>
      <pre className="whitespace-pre-wrap break-words">
        {`spl-token create-account ${mint}
spl-token mint ${mint} 1000000 ${walletAddress || "USER_WALLET_ADDRESS"}`}
      </pre>
    </div>
  );
}

export function WalletGate({ children }: { children: ReactNode }) {
  const { status } = useSession();
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
      apiFetch<{ user: { id: string; walletAddress?: string | null } }>(
        "/api/me",
      ),
    enabled: status === "authenticated",
  });

  const walletAddress = wallet.publicKey?.toBase58();
  const walletVerified =
    !!wallet.publicKey &&
    !!walletAddress &&
    meQuery.data?.user.walletAddress === walletAddress;
  const solBalance = balances.data?.sol ?? 0;
  const growBalance = balances.data?.grow?.balance ?? 0;
  const hasDevnetSol = solBalance >= MINIMUM_DEVNET_SOL;
  const hasGrow = !!mintAddress && growBalance > 0;
  const devnetConfigured = isDevnetConfigured();
  const ready =
    status === "authenticated" &&
    !!wallet.publicKey &&
    walletVerified &&
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

  const verifyWalletMutation = useMutation({
    mutationFn: () =>
      connectVerifiedWallet(wallet as unknown as WalletContextState),
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
          walletAddress,
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
          "Your wallet has no Devnet SOL. Please get Devnet SOL first.",
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
          "Your wallet has no Devnet SOL. Please get Devnet SOL first.",
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
      {
        label: "Check Devnet SOL",
        complete: !!wallet.publicKey && hasDevnetSol,
      },
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
      walletVerified,
    ],
  );
  const activeStep =
    steps.findIndex((step) => !step.complete) === -1
      ? steps.length - 1
      : steps.findIndex((step) => !step.complete);

  if (ready) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 flex flex-col relative overflow-hidden">
      {/* Soft Ambient Glows */}
      <div className="absolute top-[-10%] left-[20%] w-[600px] h-[600px] opacity-20 bg-primary/20 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] opacity-20 bg-emerald-400/20 rounded-full blur-[100px] pointer-events-none" />

      <div className="mx-auto grid min-h-[calc(100svh-4rem)] w-full max-w-6xl items-start gap-8 lg:grid-cols-[400px_minmax(0,1fr)] pt-12 relative z-10">
        
        {/* Left Sidebar: Steps */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <div className="w-10 h-10 bg-primary text-primary-foreground rounded-xl flex items-center justify-center shadow-md">
              <Leaf className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-xl font-black text-foreground">GrowFi Setup</h2>
              <p className="text-sm font-medium text-muted-foreground">Complete these steps to play</p>
            </div>
          </div>
          <div className="space-y-3">
            {steps.map((step, index) => (
              <SetupStep
                key={step.label}
                index={index + 1}
                label={step.label}
                complete={step.complete}
                active={activeStep === index}
              />
            ))}
          </div>
        </div>

        {/* Right Main Panel: Active Step Content */}
        <Card className="bg-card/80 shadow-2xl backdrop-blur-xl border border-border/50 rounded-[2rem] overflow-hidden sticky top-12">
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-bl-[100%] -z-10" />
          
          <CardHeader className="border-b border-border/30 pb-6 pt-8 px-8">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-black">
                {status !== "authenticated"
                  ? "Identity Verification"
                  : !wallet.publicKey
                    ? "Wallet Connection"
                    : !devnetConfigured || !onchain.data?.config
                      ? "Configuration Error"
                      : !hasDevnetSol
                        ? "Fund Your Wallet"
                        : !hasGrow
                          ? "Claim Tokens"
                          : !onchain.data?.player
                            ? "Initialize Player"
                            : "Prepare Land"}
              </CardTitle>
              <Badge variant="outline" className="bg-background border-primary/20 text-primary uppercase tracking-wider font-bold">
                Devnet
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="p-8 space-y-8 min-h-[400px] flex flex-col justify-center">
            {loading ? (
              <div className="space-y-4 w-full">
                <Skeleton className="h-6 w-1/3 rounded-lg" />
                <Skeleton className="h-24 w-full rounded-xl" />
                <Skeleton className="h-12 w-48 rounded-xl" />
              </div>
            ) : status !== "authenticated" ? (
              <div className="space-y-8 text-center flex flex-col items-center">
                <div className="w-20 h-20 bg-[#5865F2]/10 text-[#5865F2] rounded-[2rem] flex items-center justify-center">
                  <svg className="w-10 h-10" role="img" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0788.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground mb-2">Connect your identity</p>
                  <p className="text-sm font-medium text-muted-foreground max-w-sm mx-auto">
                    Your farm profile, inventory cache, and social identity start with Discord.
                  </p>
                </div>
                <Button 
                  onClick={() => signIn("discord")}
                  className="w-full sm:w-auto px-8 py-6 text-lg rounded-xl font-bold bg-[#5865F2] hover:bg-[#4752C4] text-white transition-all shadow-lg hover:shadow-[#5865F2]/25"
                >
                  Login with Discord
                </Button>
              </div>
            ) : !walletVerified ? (
              <div className="space-y-8">
                <div className="space-y-2">
                  <p className="text-lg font-bold text-foreground">Secure your progress</p>
                  <p className="text-sm font-medium text-muted-foreground">
                    Connect and verify a Solana wallet so GrowFi can map your on-chain player, farm, and $GROW token account.
                  </p>
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-4 p-6 bg-muted/30 border border-border rounded-[1.5rem]">
                  <div className="w-full sm:w-auto">
                    <WalletMultiButton style={{ width: '100%', height: '3.5rem', borderRadius: '0.75rem', fontWeight: 700 }} />
                  </div>
                  <Button
                    size="lg"
                    className="w-full sm:w-auto h-14 rounded-xl font-bold px-8 shadow-md"
                    disabled={!walletAddress || verifyWalletMutation.isPending}
                    onClick={() => verifyWalletMutation.mutate()}
                  >
                    {verifyWalletMutation.isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    ) : (
                      <Wallet className="h-5 w-5 mr-2" />
                    )}
                    Verify Wallet
                  </Button>
                </div>
              </div>
            ) : !devnetConfigured ? (
              <Alert variant="destructive" className="border-2 p-6 rounded-2xl">
                <ShieldAlert className="h-6 w-6" />
                <AlertTitle className="text-lg font-bold ml-2">Wrong cluster configured</AlertTitle>
                <AlertDescription className="ml-2 mt-2 text-sm font-medium">
                  Set <code className="bg-destructive/10 px-1 py-0.5 rounded">NEXT_PUBLIC_TOKEN_CLUSTER=devnet</code> and <code className="bg-destructive/10 px-1 py-0.5 rounded">NEXT_PUBLIC_TOKEN_MODE=devnet</code>, and point <code className="bg-destructive/10 px-1 py-0.5 rounded">NEXT_PUBLIC_SOLANA_RPC_URL</code> at devnet before entering the game.
                </AlertDescription>
              </Alert>
            ) : !onchain.data?.config ? (
              <Alert className="border-2 p-6 rounded-2xl bg-destructive/5 text-destructive border-destructive/20">
                <ShieldAlert className="h-6 w-6" />
                <AlertTitle className="text-lg font-bold ml-2">GrowFi program config is missing</AlertTitle>
                <AlertDescription className="ml-2 mt-2 text-sm font-medium">
                  The connected devnet program has no Config PDA yet. Run the Anchor initialize-config script with the devnet admin wallet.
                </AlertDescription>
              </Alert>
            ) : !hasDevnetSol ? (
              <div className="space-y-6">
                <Alert className="border-2 border-primary/20 bg-primary/5 p-6 rounded-2xl">
                  <Wallet className="h-6 w-6 text-primary" />
                  <AlertTitle className="text-lg font-bold ml-2 text-foreground">You need Devnet SOL for gas</AlertTitle>
                  <AlertDescription className="ml-2 mt-2 text-sm font-medium text-muted-foreground">
                    Current balance: <strong className="text-foreground">{solBalance.toFixed(4)} SOL</strong>. Add Devnet SOL before creating your on-chain player.
                  </AlertDescription>
                </Alert>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button asChild size="lg" className="rounded-xl font-bold flex-1 shadow-md">
                    <a href="https://faucet.solana.com/" target="_blank" rel="noreferrer">
                      <ExternalLink className="h-5 w-5 mr-2" />
                      Open Solana Faucet
                    </a>
                  </Button>
                  <Button variant="secondary" size="lg" className="rounded-xl font-bold" onClick={() => balances.refetch()}>
                    <RefreshCw className="h-5 w-5 mr-2" />
                    Refresh Balance
                  </Button>
                </div>
                <div className="rounded-xl bg-muted/50 border border-border p-4">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">Or use Solana CLI</p>
                  <code className="text-sm font-mono text-foreground font-semibold">solana airdrop 2 {shortAddress(walletAddress!)} --url devnet</code>
                </div>
              </div>
            ) : !hasGrow ? (
              <div className="space-y-6">
                <Alert className="border-2 border-primary/20 bg-primary/5 p-6 rounded-2xl">
                  <Coins className="h-6 w-6 text-primary" />
                  <AlertTitle className="text-lg font-bold ml-2 text-foreground">Claim Devnet $GROW</AlertTitle>
                  <AlertDescription className="ml-2 mt-2 text-sm font-medium text-muted-foreground">
                    Mint test $GROW to your connected wallet. This button only works in devnet mode when the server has a mint authority.
                  </AlertDescription>
                </Alert>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Button
                    size="lg"
                    className="flex-1 rounded-xl font-bold shadow-md"
                    disabled={mintMutation.isPending || !mintAddress}
                    onClick={() => mintMutation.mutate()}
                  >
                    {mintMutation.isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin mr-2" />
                    ) : (
                      <Coins className="h-5 w-5 mr-2" />
                    )}
                    Mint Devnet $GROW
                  </Button>
                  <Button variant="secondary" size="lg" className="rounded-xl font-bold" onClick={() => balances.refetch()}>
                    <RefreshCw className="h-5 w-5 mr-2" />
                    Refresh
                  </Button>
                </div>
                <ManualGrowInstructions
                  walletAddress={walletAddress}
                  mintAddress={mintAddress}
                />
              </div>
            ) : !onchain.data?.player ? (
              <div className="space-y-6">
                <Alert className="border-2 border-primary/20 bg-primary/5 p-6 rounded-2xl">
                  <Wallet className="h-6 w-6 text-primary" />
                  <AlertTitle className="text-lg font-bold ml-2 text-foreground">Create On-chain Player</AlertTitle>
                  <AlertDescription className="ml-2 mt-2 text-sm font-medium text-muted-foreground">
                    This creates your GrowFi player account on Solana devnet. You will approve one wallet transaction.
                  </AlertDescription>
                </Alert>
                
                <div className="grid gap-3 rounded-xl bg-muted/50 border border-border p-5 text-sm font-medium text-foreground">
                  <div className="flex justify-between items-center border-b border-border/50 pb-2">
                    <span className="text-muted-foreground">Wallet</span>
                    <span className="font-mono font-bold">{shortAddress(walletAddress!)}</span>
                  </div>
                  <div className="flex justify-between items-center border-b border-border/50 pb-2">
                    <span className="text-muted-foreground">Devnet SOL</span>
                    <span className="font-bold">{solBalance.toFixed(4)}</span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-2">
                    Requirement: enough Devnet SOL for account rent and fees.
                  </div>
                </div>

                <Button
                  size="lg"
                  className="w-full rounded-xl font-bold shadow-lg"
                  disabled={createPlayerMutation.isPending || !hasDevnetSol}
                  onClick={() => createPlayerMutation.mutate()}
                >
                  {createPlayerMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin mr-2" />
                  ) : null}
                  Initialize Player
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <Alert className="border-2 border-primary/20 bg-primary/5 p-6 rounded-2xl">
                  <Leaf className="h-6 w-6 text-primary" />
                  <AlertTitle className="text-lg font-bold ml-2 text-foreground">Initialize Farm</AlertTitle>
                  <AlertDescription className="ml-2 mt-2 text-sm font-medium text-muted-foreground">
                    This creates your farm and first 4x4 plots in a smooth batched flow. Your wallet may ask for a few approvals depending on transaction size.
                  </AlertDescription>
                </Alert>
                
                {farmProgress ? (
                  <div className="rounded-xl border border-primary/30 bg-primary/10 p-5 text-center text-sm font-bold text-primary animate-pulse shadow-inner">
                    {farmProgress}
                  </div>
                ) : null}

                <Button
                  size="lg"
                  className="w-full rounded-xl font-bold shadow-lg h-14 text-lg"
                  disabled={createFarmMutation.isPending || !hasDevnetSol}
                  onClick={() => createFarmMutation.mutate()}
                >
                  {createFarmMutation.isPending ? (
                    <Loader2 className="h-6 w-6 animate-spin mr-3" />
                  ) : null}
                  Plant First Seeds
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
