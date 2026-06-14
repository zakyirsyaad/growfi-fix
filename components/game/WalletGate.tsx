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
      className={`group flex items-center gap-4 border-2 p-4 transition-all duration-200 ${
        active
          ? "border-[#f7d767] bg-[#0a0f0d] pixel-shadow"
          : complete
            ? "border-[#3d9f4b] bg-[#0a0f0d] opacity-80"
            : "border-[#153d21] bg-[#0a0f0d] opacity-40"
      }`}
    >
      <div
        className={`flex h-10 w-10 shrink-0 items-center justify-center border-2 border-[#0a0f0d] font-pixel text-[10px] transition-colors ${
          complete
            ? "bg-[#3d9f4b] text-[#0a0f0d]"
            : active
              ? "bg-[#f7d767] text-[#0a0f0d]"
              : "bg-[#153d21] text-[#5e8c52]"
        }`}
      >
        {complete ? <CheckCircle2 className="h-5 w-5" /> : index}
      </div>
      <span
        className={`min-w-0 flex-1 font-sans text-sm font-bold ${
          active ? "text-[#f2fbf1]" : "text-[#91d985]"
        }`}
      >
        {label}
      </span>
      {active && (
        <ChevronRight className="h-5 w-5 animate-pulse text-[#f7d767]" />
      )}
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
    <div className="pixel-card-sunken p-4 font-mono text-xs text-[#91d985]">
      <div className="pixel-label mb-2">CLI fallback</div>
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
    <div className="pixel-sky scanlines relative flex min-h-screen flex-col overflow-hidden p-4 font-sans md:p-8">
      {/* Pixel sky ambience */}
      <div className="pointer-events-none absolute inset-0">
        <span className="absolute left-[14%] top-[16%] h-1.5 w-1.5 animate-pixel-twinkle bg-[#f7d767]" />
        <span className="absolute left-[80%] top-[12%] h-1.5 w-1.5 animate-pixel-twinkle bg-[#8ad4ff] [animation-delay:0.6s]" />
        <span className="absolute left-[60%] top-[28%] h-1.5 w-1.5 animate-pixel-twinkle bg-[#ff9ebd] [animation-delay:1.1s]" />
        <div className="pixel-sun absolute right-[8%] top-[10%] h-10 w-10 animate-pixel-twinkle" />
      </div>

      <div className="relative z-10 mx-auto grid min-h-[calc(100svh-4rem)] w-full max-w-6xl items-start gap-8 pt-12 lg:grid-cols-[400px_minmax(0,1fr)]">

        {/* Left Sidebar: Steps */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 px-2">
            <div className="flex h-10 w-10 items-center justify-center border-2 border-[#0a0f0d] bg-[#3d9f4b] text-[#0a0f0d] pixel-shadow">
              <Leaf className="h-5 w-5" />
            </div>
            <div>
              <h2 className="pixel-heading text-sm text-[#f2fbf1]">
                GrowFi Setup
              </h2>
              <p className="font-sans text-sm font-medium text-[#91d985]">
                Complete these steps to play
              </p>
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
        <div className="pixel-panel scanlines sticky top-12 overflow-hidden">
          <div className="border-b-2 border-[#153d21] px-8 pb-6 pt-8">
            <div className="flex items-center justify-between">
              <h3 className="pixel-heading text-base text-[#f2fbf1]">
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
              </h3>
              <span className="pixel-badge text-[#f7d767]">Devnet</span>
            </div>
          </div>

          <div className="flex min-h-[400px] flex-col justify-center space-y-8 p-8">
            {loading ? (
              <div className="w-full space-y-4">
                <Skeleton className="h-6 w-1/3 bg-[#153d21]" />
                <Skeleton className="h-24 w-full bg-[#153d21]" />
                <Skeleton className="h-12 w-48 bg-[#153d21]" />
              </div>
            ) : status !== "authenticated" ? (
              <div className="flex flex-col items-center space-y-8 text-center">
                <div className="flex h-20 w-20 items-center justify-center border-2 border-[#0a0f0d] bg-[#5865F2]/15 text-[#8ad4ff] pixel-shadow">
                  <svg className="h-10 w-10" role="img" viewBox="0 0 24 24" fill="currentColor"><path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0788.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z"/></svg>
                </div>
                <div>
                  <p className="mb-2 text-lg font-bold text-[#f2fbf1]">
                    Connect your identity
                  </p>
                  <p className="mx-auto max-w-sm font-sans text-sm font-medium text-[#91d985]">
                    Your farm profile, inventory cache, and social identity start with Discord.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => signIn("discord")}
                  className="pixel-btn w-full bg-[#5865F2] px-8 py-4 text-white hover:bg-[#4752C4] sm:w-auto"
                >
                  LOGIN WITH DISCORD
                </button>
              </div>
            ) : !walletVerified ? (
              <div className="space-y-8">
                <div className="space-y-2">
                  <p className="text-lg font-bold text-[#f2fbf1]">
                    Secure your progress
                  </p>
                  <p className="font-sans text-sm font-medium text-[#91d985]">
                    Connect and verify a Solana wallet so GrowFi can map your on-chain player, farm, and $GROW token account.
                  </p>
                </div>
                <div className="pixel-card-sunken flex flex-col items-center gap-4 p-6 sm:flex-row">
                  <div className="w-full sm:w-auto">
                    <WalletMultiButton style={{ width: '100%', height: '3.5rem', borderRadius: '0', fontWeight: 700 }} />
                  </div>
                  <button
                    type="button"
                    className="pixel-btn pixel-btn-primary w-full px-8 py-4 sm:w-auto"
                    disabled={!walletAddress || verifyWalletMutation.isPending}
                    onClick={() => verifyWalletMutation.mutate()}
                  >
                    {verifyWalletMutation.isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Wallet className="h-5 w-5" />
                    )}
                    VERIFY WALLET
                  </button>
                </div>
              </div>
            ) : !devnetConfigured ? (
              <div className="pixel-card flex items-start gap-3 border-[#a31948] p-6">
                <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-[#ff9ebd]" />
                <div>
                  <div className="pixel-heading text-xs text-[#ff9ebd]">
                    Wrong cluster configured
                  </div>
                  <p className="mt-2 font-sans text-sm font-medium text-[#ffe5ee]">
                    Set <code className="bg-[#0a0f0d] px-1 py-0.5">NEXT_PUBLIC_TOKEN_CLUSTER=devnet</code> and <code className="bg-[#0a0f0d] px-1 py-0.5">NEXT_PUBLIC_TOKEN_MODE=devnet</code>, and point <code className="bg-[#0a0f0d] px-1 py-0.5">NEXT_PUBLIC_SOLANA_RPC_URL</code> at devnet before entering the game.
                  </p>
                </div>
              </div>
            ) : !onchain.data?.config ? (
              <div className="pixel-card flex items-start gap-3 border-[#a31948] p-6">
                <ShieldAlert className="mt-0.5 h-6 w-6 shrink-0 text-[#ff9ebd]" />
                <div>
                  <div className="pixel-heading text-xs text-[#ff9ebd]">
                    GrowFi program config is missing
                  </div>
                  <p className="mt-2 font-sans text-sm font-medium text-[#ffe5ee]">
                    The connected devnet program has no Config PDA yet. Run the Anchor initialize-config script with the devnet admin wallet.
                  </p>
                </div>
              </div>
            ) : !hasDevnetSol ? (
              <div className="space-y-6">
                <div className="pixel-card flex items-start gap-3 p-6">
                  <Wallet className="mt-0.5 h-6 w-6 shrink-0 text-[#f7d767]" />
                  <div>
                    <div className="pixel-heading text-xs text-[#f2fbf1]">
                      You need Devnet SOL for gas
                    </div>
                    <p className="mt-2 font-sans text-sm font-medium text-[#91d985]">
                      Current balance: <strong className="text-[#f7d767]">{solBalance.toFixed(4)} SOL</strong>. Add Devnet SOL before creating your on-chain player.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <a
                    href="https://faucet.solana.com/"
                    target="_blank"
                    rel="noreferrer"
                    className="pixel-btn pixel-btn-primary flex-1 px-6 py-4"
                  >
                    <ExternalLink className="h-5 w-5" />
                    OPEN SOLANA FAUCET
                  </a>
                  <button
                    type="button"
                    className="pixel-btn pixel-btn-ghost px-6 py-4"
                    onClick={() => balances.refetch()}
                  >
                    <RefreshCw className="h-5 w-5" />
                    REFRESH BALANCE
                  </button>
                </div>
                <div className="pixel-card-sunken p-4">
                  <p className="pixel-label mb-2">Or use Solana CLI</p>
                  <code className="font-mono text-sm font-semibold text-[#ddf5d9]">solana airdrop 2 {shortAddress(walletAddress!)} --url devnet</code>
                </div>
              </div>
            ) : !hasGrow ? (
              <div className="space-y-6">
                <div className="pixel-card flex items-start gap-3 p-6">
                  <Coins className="mt-0.5 h-6 w-6 shrink-0 text-[#f7d767]" />
                  <div>
                    <div className="pixel-heading text-xs text-[#f2fbf1]">
                      Claim Devnet $GROW
                    </div>
                    <p className="mt-2 font-sans text-sm font-medium text-[#91d985]">
                      Mint test $GROW to your connected wallet. This button only works in devnet mode when the server has a mint authority.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <button
                    type="button"
                    className="pixel-btn pixel-btn-gold flex-1 px-6 py-4"
                    disabled={mintMutation.isPending || !mintAddress}
                    onClick={() => mintMutation.mutate()}
                  >
                    {mintMutation.isPending ? (
                      <Loader2 className="h-5 w-5 animate-spin" />
                    ) : (
                      <Coins className="h-5 w-5" />
                    )}
                    MINT DEVNET $GROW
                  </button>
                  <button
                    type="button"
                    className="pixel-btn pixel-btn-ghost px-6 py-4"
                    onClick={() => balances.refetch()}
                  >
                    <RefreshCw className="h-5 w-5" />
                    REFRESH
                  </button>
                </div>
                <ManualGrowInstructions
                  walletAddress={walletAddress}
                  mintAddress={mintAddress}
                />
              </div>
            ) : !onchain.data?.player ? (
              <div className="space-y-6">
                <div className="pixel-card flex items-start gap-3 p-6">
                  <Wallet className="mt-0.5 h-6 w-6 shrink-0 text-[#f7d767]" />
                  <div>
                    <div className="pixel-heading text-xs text-[#f2fbf1]">
                      Create On-chain Player
                    </div>
                    <p className="mt-2 font-sans text-sm font-medium text-[#91d985]">
                      This creates your GrowFi player account on Solana devnet. You will approve one wallet transaction.
                    </p>
                  </div>
                </div>

                <div className="pixel-card-sunken grid gap-3 p-5 text-sm font-medium text-[#ddf5d9]">
                  <div className="flex items-center justify-between border-b-2 border-[#153d21] pb-2">
                    <span className="text-[#91d985]">Wallet</span>
                    <span className="font-mono font-bold">{shortAddress(walletAddress!)}</span>
                  </div>
                  <div className="flex items-center justify-between border-b-2 border-[#153d21] pb-2">
                    <span className="text-[#91d985]">Devnet SOL</span>
                    <span className="font-bold">{solBalance.toFixed(4)}</span>
                  </div>
                  <div className="mt-2 text-xs text-[#5e8c52]">
                    Requirement: enough Devnet SOL for account rent and fees.
                  </div>
                </div>

                <button
                  type="button"
                  className="pixel-btn pixel-btn-primary w-full px-6 py-4"
                  disabled={createPlayerMutation.isPending || !hasDevnetSol}
                  onClick={() => createPlayerMutation.mutate()}
                >
                  {createPlayerMutation.isPending ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : null}
                  INITIALIZE PLAYER
                </button>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="pixel-card flex items-start gap-3 p-6">
                  <Leaf className="mt-0.5 h-6 w-6 shrink-0 text-[#f7d767]" />
                  <div>
                    <div className="pixel-heading text-xs text-[#f2fbf1]">
                      Initialize Farm
                    </div>
                    <p className="mt-2 font-sans text-sm font-medium text-[#91d985]">
                      This creates your farm and first 4x4 plots in a smooth batched flow. Your wallet may ask for a few approvals depending on transaction size.
                    </p>
                  </div>
                </div>

                {farmProgress ? (
                  <div className="pixel-card-sunken animate-pulse border-[#3d9f4b] p-5 text-center text-sm font-bold text-[#f7d767]">
                    {farmProgress}
                  </div>
                ) : null}

                <button
                  type="button"
                  className="pixel-btn pixel-btn-primary w-full px-6 py-4"
                  disabled={createFarmMutation.isPending || !hasDevnetSol}
                  onClick={() => createFarmMutation.mutate()}
                >
                  {createFarmMutation.isPending ? (
                    <Loader2 className="h-6 w-6 animate-spin" />
                  ) : null}
                  PLANT FIRST SEEDS
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
