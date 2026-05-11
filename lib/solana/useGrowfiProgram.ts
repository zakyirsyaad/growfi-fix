"use client";

import { useMemo } from "react";
import { BN, Program, type Idl } from "@coral-xyz/anchor";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import {
  PublicKey,
  SystemProgram,
  Transaction,
  type TransactionInstruction,
  type VersionedTransaction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import idl from "@/lib/idl/growfi_core.json";
import {
  ONCHAIN_SEEDS,
  MUTATION_VARIANTS,
  findOnchainSeed,
  type OnchainSeedMetadata,
} from "@/lib/solana/growfiData";
import {
  createGrowfiAnchorProvider,
  getGrowTokenMint,
  getGrowfiCoreProgramId,
  growfiPdas,
  type AnchorWalletLike,
} from "@/lib/solana/growfiCore";
import type {
  FruitView,
  GardenPlotView,
  GardenResponse,
  InventoryResponse,
  Mutation,
  PlantState,
  PlotState,
  SeedView,
} from "@/types/game-data";

type AnchorProgram = Program<Idl>;
type AccountClient<TAccount = unknown> = {
  fetch(address: PublicKey): Promise<TAccount>;
  fetchNullable?: (address: PublicKey) => Promise<TAccount | null>;
  all?: () => Promise<Array<{ publicKey: PublicKey; account: TAccount }>>;
};
type AccountClients = Record<string, AccountClient>;
type MethodBuilder = {
  accounts(accounts: Record<string, unknown>): {
    transaction(): Promise<Transaction>;
  };
};
type ProgramMethod = (...args: unknown[]) => MethodBuilder;
type ProgramMethods = Record<string, ProgramMethod>;

type TransactionSigner = {
  publicKey: PublicKey | null;
  signTransaction?: <T extends Transaction | VersionedTransaction>(
    transaction: T
  ) => Promise<T>;
  signAllTransactions?: <T extends Transaction | VersionedTransaction>(
    transactions: T[]
  ) => Promise<T[]>;
};

type ShopItemAccount = {
  rotationId: BN;
  seedId: BN;
  price: BN;
  stockTotal: BN;
  stockRemaining: BN;
  maxBuyPerUser: BN;
};

type ShopRotationAccount = {
  rotationId: BN;
  startsAt: BN;
  endsAt: BN;
};

type PlotAccount = {
  x: number;
  y: number;
  state: Record<string, unknown>;
  seedId: BN;
  plantedAt: BN;
  growCompleteAt: BN;
  nextHarvestAt: BN;
  harvestCount: number;
  maxHarvests: number;
  waterLevel: number;
  health: number;
  permanentMutation: Record<string, unknown>;
};

type ConfigAccount = {
  growMint: PublicKey;
  treasuryVault: PublicKey;
};

type FarmAccount = {
  level: number;
  width: number;
  height: number;
  plotCount: number;
};

type PlayerAccount = {
  farm: PublicKey;
  gardenLevel: number;
  stamina: number;
  maxStamina: number;
  waterCharges: number;
  maxWaterCharges: number;
  totalHarvests: BN;
  totalTrades: BN;
};

type ShopPurchaseAccount = {
  amountBought: BN;
};
type SeedInventoryAccount = {
  balances: Array<{ itemId: BN; amount: BN }>;
};
type FruitInventoryAccount = {
  balances: Array<{
    fruitId: BN;
    mutation: Record<string, unknown>;
    amount: BN;
    lockedAmount: BN;
  }>;
};

type MarketplaceListingAccount = {
  listingId: BN;
  seller: PublicKey;
  fruitId: BN;
  mutation: Record<string, unknown>;
  quantity: BN;
  price: BN;
  status: Record<string, unknown>;
  createdAt: BN;
  expiresAt: BN;
};

export type OnchainMarketplaceListingView = {
  id: string;
  address: string;
  listingId: string;
  sellerId: string;
  sellerWallet: string;
  quantity: number;
  price: number;
  mutation: Mutation;
  status: "ACTIVE" | "SOLD" | "CANCELLED" | "EXPIRED";
  createdAt: string;
  expiresAt: string;
  source: "onchain";
  fruit: {
    id: string;
    name: string;
    iconUrl: string;
    rarity: FruitView["rarity"];
  };
  seller: { id: string; username: string; avatarUrl?: string | null };
};

export type GrowfiOnchainState = {
  wallet: PublicKey | null;
  configPda: PublicKey;
  config: unknown | null;
  playerPda: PublicKey | null;
  player: unknown | null;
  farmPda: PublicKey | null;
  farm: unknown | null;
  seedInventoryPda: PublicKey | null;
  seedInventory: unknown | null;
  seedStacks: GardenResponse["seeds"];
  fruitInventoryPda: PublicKey | null;
  fruitInventory: unknown | null;
  fruitStacks: InventoryResponse["fruits"];
  decorationInventoryPda: PublicKey | null;
  decorationInventory: unknown | null;
  plots: Array<{
    publicKey: PublicKey;
    account: unknown | null;
    x: number;
    y: number;
  }>;
};

type AnchorLikeError = {
  error?: {
    errorCode?: { code?: string; name?: string };
    errorMessage?: string;
  };
  errorCode?: { code?: string; name?: string };
  errorMessage?: string;
};

const FRIENDLY_ANCHOR_ERRORS: Record<string, string> = {
  GamePaused: "GrowFi is paused right now.",
  Unauthorized: "This wallet is not authorized for that action.",
  InvalidMint: "The configured $GROW mint does not match this program.",
  InsufficientBalance: "Not enough $GROW.",
  InsufficientSeed: "You do not have that seed in your on-chain inventory.",
  InsufficientFruit: "You do not have enough unlocked fruit.",
  FruitLocked: "That fruit is locked in another action.",
  PlotNotEmpty: "That plot already has a plant.",
  PlotEmpty: "That plot has no active plant.",
  PlantNotReady: "That plant is not ready yet.",
  GardenLevelTooLow: "Your farm level is too low for that seed.",
  GARDEN_LEVEL_TOO_LOW: "Your farm level is too low for that seed.",
  InsufficientStamina: "Not enough stamina.",
  InsufficientWater: "Your watering can is empty.",
  ShopExpired: "This shop rotation is no longer active.",
  ShopOutOfStock: "That seed is out of stock.",
  MaxBuyReached: "You reached the buy limit for that seed.",
  ListingInactive: "That listing is not active.",
  ListingExpired: "That listing has expired.",
  TradeExpired: "That trade has expired.",
  TradeNotConfirmed: "Both players need to confirm the trade.",
  InvalidTradeState: "That trade is not in the right state.",
  AlreadyClaimed: "That reward or action was already claimed.",
  InvalidAmount: "The amount is invalid.",
  MathOverflow: "The program rejected the math for this action.",
  InventoryFull: "Your on-chain inventory is full.",
  InvalidAccountState:
    "One of the on-chain accounts is not in the expected state.",
};
const GROW_BASE_UNITS = 1_000_000_000;
const MUTATION_MULTIPLIER_BPS: Record<Mutation, bigint> = {
  NORMAL: 10_000n,
  BIG: 15_000n,
  SWEET: 20_000n,
  GOLDEN: 50_000n,
  CRYSTAL: 100_000n,
  RAINBOW: 500_000n,
};
const FARM_UPGRADES: Record<
  number,
  { width: number; height: number; cost: number }
> = {
  1: { width: 4, height: 4, cost: 0 },
  2: { width: 5, height: 5, cost: 250 },
  3: { width: 6, height: 6, cost: 750 },
  4: { width: 8, height: 8, cost: 2_000 },
  5: { width: 10, height: 10, cost: 5_000 },
};

function asBn(value: number | bigint | string | BN) {
  return value instanceof BN ? value : new BN(value.toString());
}

function bnToNumber(value: unknown) {
  if (value instanceof BN) {
    return (value as BN).toNumber();
  }
  if (typeof value === "number") {
    return value;
  }
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (value && typeof value === "object" && "toNumber" in value) {
    return Number((value as { toNumber: () => number }).toNumber());
  }
  return Number(value);
}

function growFromBaseUnits(value: unknown) {
  return bnToNumber(value) / GROW_BASE_UNITS;
}

function variantName(value: unknown) {
  if (!value || typeof value !== "object") {
    return String(value);
  }
  return Object.keys(value as Record<string, unknown>)[0] || String(value);
}

function enumVariant(name: string) {
  return { [name.charAt(0).toLowerCase() + name.slice(1)]: {} };
}

function seedViewFromMetadata(
  metadata: OnchainSeedMetadata | undefined,
  seedId: number
): SeedView {
  return {
    id: String(seedId),
    slug: metadata?.slug,
    name: metadata?.name || `Seed ${seedId}`,
    iconUrl: metadata?.name.slice(0, 1) || "S",
    rarity: metadata?.rarity || "COMMON",
    basePrice: metadata?.price || 0,
    growTimeSeconds: metadata?.growTimeSeconds || 0,
    harvestCooldownSeconds: metadata?.harvestCooldownSeconds || 0,
    regrowTimeSeconds: metadata?.regrowTimeSeconds || 0,
    maxHarvests: metadata?.maxHarvests || 1,
    minYield: metadata?.minYield || 1,
    maxYield: metadata?.maxYield || 1,
    requiredGardenLevel: metadata?.requiredGardenLevel || 1,
  };
}

function fruitViewFromMetadata(
  metadata: OnchainSeedMetadata | undefined,
  fruitId: number
): FruitView {
  return {
    id: String(fruitId),
    slug: metadata?.slug,
    name: metadata?.fruitName || `Fruit ${fruitId}`,
    iconUrl: metadata?.fruitName.slice(0, 1) || "F",
    rarity: metadata?.rarity || "COMMON",
    baseSellPrice: metadata?.baseSellPrice || 0,
  };
}

function mutationFromOnchain(value: unknown): Mutation {
  const name = variantName(value).toLowerCase();
  const entry = Object.entries(MUTATION_VARIANTS).find(
    ([mutation, anchorName]) =>
      mutation.toLowerCase() === name || anchorName.toLowerCase() === name
  );
  return (entry?.[0] as Mutation | undefined) || "NORMAL";
}

function isoFromUnixSeconds(value: unknown) {
  const seconds = bnToNumber(value);
  return seconds > 0 ? new Date(seconds * 1000).toISOString() : null;
}

function plotStateFromOnchain(account: PlotAccount): PlotState {
  const state = variantName(account.state).toLowerCase();
  const mapped: Record<string, PlotState> = {
    empty: "EMPTY",
    growing: "GROWING",
    ready: "READY",
    regrowing: "REGROWING",
    locked: "LOCKED",
    withered: "LOCKED",
  };
  const plotState = mapped[state] || "EMPTY";
  if (plotState !== "GROWING" && plotState !== "REGROWING") {
    return plotState;
  }

  const readyAt =
    plotState === "REGROWING"
      ? bnToNumber(account.nextHarvestAt)
      : bnToNumber(account.growCompleteAt);
  if (readyAt > 0 && readyAt <= Math.floor(Date.now() / 1000)) {
    return "READY";
  }
  return plotState;
}

function plantStateFromPlotState(state: PlotState): PlantState {
  if (state === "READY") {
    return "READY";
  }
  if (state === "REGROWING") {
    return "REGROWING";
  }
  return "GROWING";
}

function visualStageForOnchainPlot(
  account: PlotAccount,
  state: PlotState
): NonNullable<GardenPlotView["plant"]>["visualStage"] {
  if (state === "READY") {
    return "ready";
  }
  if (state === "REGROWING") {
    return "regrowing";
  }
  if (state === "LOCKED") {
    return "locked";
  }
  if (state === "EMPTY") {
    return "empty";
  }

  const plantedAt = bnToNumber(account.plantedAt) * 1000;
  const growCompleteAt = bnToNumber(account.growCompleteAt) * 1000;
  const duration = Math.max(1, growCompleteAt - plantedAt);
  const progress = Math.max(0, Math.min(1, (Date.now() - plantedAt) / duration));
  if (progress > 0.66) {
    return "medium";
  }
  if (progress > 0.33) {
    return "small";
  }
  return "sprout";
}

function gardenStatsFromPlots(plots: GardenPlotView[]) {
  return plots.reduce(
    (stats, plot) => {
      const active = !!plot.plant && plot.state !== "EMPTY";
      return {
        totalPlots: stats.totalPlots + 1,
        activePlants: stats.activePlants + (active ? 1 : 0),
        readyToHarvest:
          stats.readyToHarvest +
          (plot.state === "READY" || plot.plant?.state === "READY" ? 1 : 0),
        growingPlants:
          stats.growingPlants +
          (plot.state === "GROWING" || plot.plant?.state === "GROWING" ? 1 : 0),
        regrowingPlants:
          stats.regrowingPlants +
          (plot.state === "REGROWING" ||
          plot.plant?.state === "REGROWING"
            ? 1
            : 0),
      };
    },
    {
      totalPlots: 0,
      activePlants: 0,
      readyToHarvest: 0,
      growingPlants: 0,
      regrowingPlants: 0,
    }
  );
}

function upgradeSummary(level: number, fallback?: GardenResponse["upgrades"]) {
  const next = FARM_UPGRADES[level + 1];
  return {
    currentLevel: level,
    nextLevel: next ? level + 1 : undefined,
    nextWidth: next?.width,
    nextHeight: next?.height,
    cost: next?.cost,
    maxLevel: fallback?.maxLevel || Math.max(...Object.keys(FARM_UPGRADES).map(Number)),
  };
}

function onchainPlotToGardenPlot(
  entry: GrowfiOnchainState["plots"][number],
  fallback?: GardenPlotView
): GardenPlotView {
  if (!entry.account) {
    return (
      fallback || {
        id: entry.publicKey.toBase58(),
        x: entry.x,
        y: entry.y,
        state: "LOCKED",
        plant: null,
      }
    );
  }

  const account = entry.account as PlotAccount;
  const seedId = bnToNumber(account.seedId);
  const state = plotStateFromOnchain(account);
  if (state === "EMPTY" || seedId <= 0) {
    return {
      id: entry.publicKey.toBase58(),
      x: Number(account.x ?? entry.x),
      y: Number(account.y ?? entry.y),
      state: "EMPTY",
      plant: null,
    };
  }

  const metadata = ONCHAIN_SEEDS.find((seed) => seed.seedId === seedId);
  const seed = seedViewFromMetadata(metadata, seedId);
  const growCompleteAt = isoFromUnixSeconds(account.growCompleteAt);
  const nextHarvestAt = isoFromUnixSeconds(account.nextHarvestAt);

  return {
    id: entry.publicKey.toBase58(),
    x: Number(account.x ?? entry.x),
    y: Number(account.y ?? entry.y),
    state,
    plant: {
      id: `onchain-plant-${entry.publicKey.toBase58()}`,
      state: plantStateFromPlotState(state),
      growCompleteAt: growCompleteAt || new Date().toISOString(),
      nextHarvestAt,
      waterLevel: Number(account.waterLevel || 0),
      health: Number(account.health || 0),
      harvestCount: Number(account.harvestCount || 0),
      maxHarvests: Number(account.maxHarvests || metadata?.maxHarvests || 1),
      permanentMutation: mutationFromOnchain(account.permanentMutation),
      seed: {
        ...seed,
        fruit: fruitViewFromMetadata(metadata, metadata?.fruitId || seedId),
      },
      visualStage: visualStageForOnchainPlot(account, state),
    },
  };
}

export function mergeOnchainGarden(
  garden: GardenResponse | undefined,
  onchain: GrowfiOnchainState | null | undefined
) {
  if (!garden || !onchain?.farm) {
    return garden;
  }

  const farm = onchain.farm as FarmAccount;
  const player = onchain.player as PlayerAccount | null;
  const existingByCoord = new Map(
    garden.garden.plots.map((plot) => [`${plot.x}:${plot.y}`, plot])
  );
  const plots =
    onchain.plots.length > 0
      ? onchain.plots
          .map((entry) =>
            onchainPlotToGardenPlot(
              entry,
              existingByCoord.get(`${entry.x}:${entry.y}`)
            )
          )
          .sort((a, b) => a.y - b.y || a.x - b.x)
      : garden.garden.plots;
  const farmStats = gardenStatsFromPlots(plots);
  const level = Number(farm.level || garden.garden.level);
  const width = Number(farm.width || garden.garden.width);
  const height = Number(farm.height || garden.garden.height);
  const gardenLevel = Number(player?.gardenLevel || garden.user.gardenLevel);
  const waterCharges =
    player?.waterCharges != null
      ? Number(player.waterCharges)
      : garden.user.waterCharges;
  const maxWaterCharges =
    player?.maxWaterCharges != null
      ? Number(player.maxWaterCharges)
      : garden.user.maxWaterCharges;

  return {
    ...garden,
    user: {
      ...garden.user,
      walletAddress: onchain.wallet?.toBase58() || garden.user.walletAddress,
      gardenLevel,
      stamina: Number(player?.stamina ?? garden.user.stamina),
      maxStamina: Number(player?.maxStamina ?? garden.user.maxStamina),
      waterCharges,
      maxWaterCharges,
      totalHarvests:
        player?.totalHarvests != null
          ? bnToNumber(player.totalHarvests)
          : garden.user.totalHarvests,
      totalTrades:
        player?.totalTrades != null
          ? bnToNumber(player.totalTrades)
          : garden.user.totalTrades,
    },
    garden: {
      ...garden.garden,
      id: onchain.farmPda?.toBase58() || garden.garden.id,
      width,
      height,
      level,
      plots,
    },
    farmStats,
    upgrades: upgradeSummary(level, garden.upgrades),
    progression: garden.progression
      ? {
          ...garden.progression,
          currentGardenLevel: gardenLevel,
          farmSize: `${width}x${height}`,
          totalPlots: farmStats.totalPlots,
          activePlants: farmStats.activePlants,
          readyToHarvestCount: farmStats.readyToHarvest,
        }
      : garden.progression,
    seeds: onchain.seedInventory ? onchain.seedStacks : garden.seeds,
  } satisfies GardenResponse;
}

export function mergeOnchainInventory(
  inventory: InventoryResponse | undefined,
  onchain: GrowfiOnchainState | null | undefined
) {
  if (!inventory || !onchain) {
    return inventory;
  }

  return {
    seeds: onchain.seedInventory ? onchain.seedStacks : inventory.seeds,
    fruits: onchain.fruitInventory ? onchain.fruitStacks : inventory.fruits,
  } satisfies InventoryResponse;
}

function zeroHash() {
  return Array(32).fill(0);
}

function shortSignature(signature: string) {
  return `${signature.slice(0, 6)}...${signature.slice(-6)}`;
}

function explorerUrl(signature: string) {
  return `https://explorer.solana.com/tx/${signature}?cluster=devnet`;
}

function shortAddress(value: string) {
  return value.length > 12 ? `${value.slice(0, 4)}...${value.slice(-4)}` : value;
}

function listingStatusFromOnchain(
  account: MarketplaceListingAccount
): OnchainMarketplaceListingView["status"] {
  const raw = variantName(account.status).toLowerCase();
  const status =
    raw === "sold"
      ? "SOLD"
      : raw === "cancelled" || raw === "canceled"
      ? "CANCELLED"
      : raw === "expired"
      ? "EXPIRED"
      : "ACTIVE";
  const expiresAt = bnToNumber(account.expiresAt);
  if (status === "ACTIVE" && expiresAt > 0 && expiresAt <= Date.now() / 1000) {
    return "EXPIRED";
  }
  return status;
}

function marketplaceListingToView(entry: {
  publicKey: PublicKey;
  account: MarketplaceListingAccount;
}): OnchainMarketplaceListingView {
  const fruitId = bnToNumber(entry.account.fruitId);
  const metadata = ONCHAIN_SEEDS.find(
    (seed) => seed.fruitId === fruitId || seed.seedId === fruitId
  );
  const fruit = fruitViewFromMetadata(metadata, fruitId);
  const sellerWallet = entry.account.seller.toBase58();
  const listingId = bnToNumber(entry.account.listingId).toString();
  return {
    id: `onchain-${entry.publicKey.toBase58()}`,
    address: entry.publicKey.toBase58(),
    listingId,
    sellerId: sellerWallet,
    sellerWallet,
    quantity: bnToNumber(entry.account.quantity),
    price: growFromBaseUnits(entry.account.price),
    mutation: mutationFromOnchain(entry.account.mutation),
    status: listingStatusFromOnchain(entry.account),
    createdAt:
      isoFromUnixSeconds(entry.account.createdAt) || new Date(0).toISOString(),
    expiresAt:
      isoFromUnixSeconds(entry.account.expiresAt) || new Date(0).toISOString(),
    source: "onchain",
    fruit: {
      id: fruit.id || String(fruitId),
      name: fruit.name,
      iconUrl: fruit.iconUrl,
      rarity: fruit.rarity,
    },
    seller: {
      id: sellerWallet,
      username: shortAddress(sellerWallet),
      avatarUrl: null,
    },
  };
}

function getProgramErrors() {
  return (
    (idl as { errors?: Array<{ code: number; name: string; msg: string }> })
      .errors || []
  );
}

export function decodeGrowfiError(error: unknown) {
  const anchorError = error as AnchorLikeError;
  const anchorName =
    anchorError.error?.errorCode?.code ||
    anchorError.errorCode?.code ||
    anchorError.error?.errorCode?.name;
  if (anchorName && FRIENDLY_ANCHOR_ERRORS[anchorName]) {
    return FRIENDLY_ANCHOR_ERRORS[anchorName];
  }

  const text = error instanceof Error ? error.message : String(error);
  if (/Attempt to debit an account but found no record of a prior credit/i.test(text)) {
    return "Your wallet has no Devnet SOL. Please get Devnet SOL from the faucet.";
  }
  const hex = text.match(/custom program error: (0x[0-9a-f]+)/i);
  const decimal = text.match(/custom program error: ([0-9]+)/i);
  const code = hex
    ? Number.parseInt(hex[1], 16)
    : decimal
    ? Number(decimal[1])
    : null;
  if (code != null) {
    const idlError = getProgramErrors().find((entry) => entry.code === code);
    if (idlError) {
      return FRIENDLY_ANCHOR_ERRORS[idlError.name] || idlError.msg;
    }
  }

  const logMatch = text.match(/AnchorError.*Error Code: ([A-Za-z0-9_]+)/);
  if (logMatch && FRIENDLY_ANCHOR_ERRORS[logMatch[1]]) {
    return FRIENDLY_ANCHOR_ERRORS[logMatch[1]];
  }

  if (/insufficient funds|insufficient lamports/i.test(text)) {
    return "Not enough SOL or $GROW to complete the transaction.";
  }
  if (/User rejected|rejected the request|wallet/i.test(text)) {
    return "Wallet approval was cancelled.";
  }
  return text;
}

async function fetchNullable(
  program: AnchorProgram,
  accountName: string,
  address: PublicKey
) {
  const accountClient = (program.account as unknown as AccountClients)[
    accountName
  ];
  if (!accountClient) {
    throw new Error(`Missing account client ${accountName}.`);
  }
  if (typeof accountClient.fetchNullable === "function") {
    return accountClient.fetchNullable(address);
  }
  try {
    return await accountClient.fetch(address);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (/Account does not exist|not found|AccountNotFound/i.test(message)) {
      return null;
    }
    throw error;
  }
}

function makeProviderWallet(wallet: TransactionSigner): AnchorWalletLike {
  const publicKey = wallet.publicKey || SystemProgram.programId;
  return {
    publicKey,
    signTransaction: async (transaction) => {
      if (!wallet.signTransaction) {
        throw new Error(
          "Connected wallet does not support transaction signing."
        );
      }
      return wallet.signTransaction(transaction);
    },
    signAllTransactions: async (transactions) => {
      if (wallet.signAllTransactions) {
        return wallet.signAllTransactions(transactions);
      }
      if (!wallet.signTransaction) {
        throw new Error(
          "Connected wallet does not support transaction signing."
        );
      }
      const signed = [];
      for (const transaction of transactions) {
        signed.push(await wallet.signTransaction(transaction));
      }
      return signed;
    },
  };
}

export function useGrowfiClient() {
  const { connection } = useConnection();
  const wallet = useWallet();
  const programId = useMemo(() => getGrowfiCoreProgramId(), []);
  const provider = useMemo(
    () =>
      createGrowfiAnchorProvider(
        connection,
        makeProviderWallet({
          publicKey: wallet.publicKey,
          signTransaction: wallet.signTransaction,
          signAllTransactions: wallet.signAllTransactions,
        }),
        "confirmed"
      ),
    [
      connection,
      wallet.publicKey,
      wallet.signAllTransactions,
      wallet.signTransaction,
    ]
  );
  const program = useMemo(
    () =>
      new Program({ ...(idl as Idl), address: programId.toBase58() }, provider),
    [programId, provider]
  );

  return { connection, wallet, provider, program, programId };
}

export function useGrowfiOnchainState(enabled = true) {
  const { wallet, program, programId } = useGrowfiClient();
  return useQuery<GrowfiOnchainState>({
    queryKey: [
      "growfi-onchain-state",
      programId.toBase58(),
      wallet.publicKey?.toBase58(),
    ],
    enabled,
    queryFn: async () => {
      const [configPda] = growfiPdas.config(programId);
      const config = await fetchNullable(program, "config", configPda);

      if (!wallet.publicKey) {
        return {
          wallet: null,
          configPda,
          config,
          playerPda: null,
          player: null,
          farmPda: null,
          farm: null,
          seedInventoryPda: null,
          seedInventory: null,
          seedStacks: [],
          fruitInventoryPda: null,
          fruitInventory: null,
          fruitStacks: [],
          decorationInventoryPda: null,
          decorationInventory: null,
          plots: [],
        };
      }

      const [playerPda] = growfiPdas.player(wallet.publicKey, programId);
      const [farmPda] = growfiPdas.farm(wallet.publicKey, programId);
      const [seedInventoryPda] = growfiPdas.seedInventory(
        wallet.publicKey,
        programId
      );
      const [fruitInventoryPda] = growfiPdas.fruitInventory(
        wallet.publicKey,
        programId
      );
      const [decorationInventoryPda] = growfiPdas.decorationInventory(
        wallet.publicKey,
        programId
      );
      const [player, farm, seedInventory, fruitInventory, decorationInventory] =
        await Promise.all([
          fetchNullable(program, "player", playerPda),
          fetchNullable(program, "farm", farmPda),
          fetchNullable(program, "seedInventory", seedInventoryPda),
          fetchNullable(program, "fruitInventory", fruitInventoryPda),
          fetchNullable(program, "decorationInventory", decorationInventoryPda),
        ]);
      const seedStacks = (
        (seedInventory as SeedInventoryAccount | null)?.balances || []
      )
        .filter((balance) => bnToNumber(balance.amount) > 0)
        .map((balance) => {
          const seedId = bnToNumber(balance.itemId);
          const metadata = ONCHAIN_SEEDS.find((seed) => seed.seedId === seedId);
          return {
            id: `onchain-seed-${seedId}`,
            seedId: String(seedId),
            quantity: bnToNumber(balance.amount),
            seed: seedViewFromMetadata(metadata, seedId),
          };
        });
      const fruitStacks = (
        (fruitInventory as FruitInventoryAccount | null)?.balances || []
      )
        .filter((balance) => bnToNumber(balance.amount) > 0)
        .map((balance) => {
          const fruitId = bnToNumber(balance.fruitId);
          const metadata = ONCHAIN_SEEDS.find(
            (seed) => seed.fruitId === fruitId || seed.seedId === fruitId
          );
          const mutation = mutationFromOnchain(balance.mutation);
          return {
            id: `onchain-fruit-${fruitId}-${mutation.toLowerCase()}`,
            quantity: bnToNumber(balance.amount),
            lockedQuantity: bnToNumber(balance.lockedAmount || 0),
            mutation,
            fruit: fruitViewFromMetadata(metadata, fruitId),
          };
        });
      const plots: GrowfiOnchainState["plots"] = [];

      if (farm) {
        const farmAccount = farm as FarmAccount;
        const width = Number(farmAccount.width);
        const height = Number(farmAccount.height);
        for (let y = 0; y < height; y += 1) {
          for (let x = 0; x < width; x += 1) {
            const [plotPda] = growfiPdas.plot(farmPda, x, y, programId);
            const plot = await fetchNullable(program, "plot", plotPda);
            plots.push({ publicKey: plotPda, account: plot, x, y });
          }
        }
      }

      return {
        wallet: wallet.publicKey,
        configPda,
        config,
        playerPda,
        player,
        farmPda,
        farm,
        seedInventoryPda,
        seedInventory,
        seedStacks,
        fruitInventoryPda,
        fruitInventory,
        fruitStacks,
        decorationInventoryPda,
        decorationInventory,
        plots,
      };
    },
  });
}

export function useGrowfiShop(enabled = true) {
  const { wallet, program, programId } = useGrowfiClient();
  return useQuery({
    queryKey: [
      "growfi-onchain-shop",
      programId.toBase58(),
      wallet.publicKey?.toBase58(),
    ],
    enabled,
    refetchInterval: 15_000,
    queryFn: async () => {
      await fetch("/api/shop/ensure-active-rotation", {
        method: "POST",
      }).catch((error) => {
        if (process.env.NODE_ENV === "development") {
          console.warn("[GrowFi] shop auto-create skipped", error);
        }
      });
      const now = Math.floor(Date.now() / 1000);
      const accountClients = program.account as unknown as {
        shopRotation: AccountClient<ShopRotationAccount>;
        shopItem: AccountClient<ShopItemAccount>;
      };
      if (!accountClients.shopRotation.all || !accountClients.shopItem.all) {
        throw new Error(
          "GrowFi IDL account clients cannot list shop accounts."
        );
      }
      const rotations = (await accountClients.shopRotation.all())
        .map((entry) => ({
          ...entry,
          rotationId: bnToNumber(entry.account.rotationId),
          startsAt: bnToNumber(entry.account.startsAt),
          endsAt: bnToNumber(entry.account.endsAt),
        }))
        .filter((entry) => entry.startsAt <= now && entry.endsAt > now)
        .sort((a, b) => b.startsAt - a.startsAt)[0];

      const seedCatalogCount = ONCHAIN_SEEDS.length;
      if (!rotations) {
        if (process.env.NODE_ENV === "development") {
          console.debug("[GrowFi] shop rotation lookup", {
            currentUnixTime: now,
            activeRotationId: null,
            startsAt: null,
            endsAt: null,
            shopItemsLoaded: 0,
            seedCatalogCount,
          });
        }
        return { rotation: null, items: [] };
      }

      const shopItems = await accountClients.shopItem.all();

      const items = await Promise.all(
        shopItems
          .filter(
            (entry) =>
              bnToNumber(entry.account.rotationId) === rotations.rotationId
          )
          .sort(
            (a, b) =>
              bnToNumber(a.account.seedId) - bnToNumber(b.account.seedId)
          )
          .map(async (entry) => {
            const seedId = bnToNumber(entry.account.seedId);
            const metadata = ONCHAIN_SEEDS.find(
              (seed) => seed.seedId === seedId
            );
            const [purchasePda] = wallet.publicKey
              ? growfiPdas.shopPurchase(
                  wallet.publicKey,
                  rotations.rotationId,
                  seedId,
                  programId
                )
              : [null];
            const purchase = purchasePda
              ? await fetchNullable(program, "shopPurchase", purchasePda)
              : null;

            return {
              id: entry.publicKey.toBase58(),
              publicKey: entry.publicKey,
              rotationId: rotations.rotationId,
              seedId,
              price: growFromBaseUnits(entry.account.price),
              stockRemaining: bnToNumber(entry.account.stockRemaining),
              stockTotal: bnToNumber(entry.account.stockTotal),
              maxBuyPerUser: bnToNumber(entry.account.maxBuyPerUser),
              purchasedByUser: purchase
                ? bnToNumber((purchase as ShopPurchaseAccount).amountBought)
                : 0,
              seed: {
                id: String(seedId),
                slug: metadata?.slug,
                name: metadata?.name || `Seed ${seedId}`,
                iconUrl: metadata?.name.slice(0, 1) || "S",
                rarity: metadata?.rarity || "COMMON",
                growTimeSeconds: metadata?.growTimeSeconds || 0,
                harvestCooldownSeconds: metadata?.harvestCooldownSeconds || 0,
                regrowTimeSeconds: metadata?.regrowTimeSeconds || 0,
                minYield: metadata?.minYield || 1,
                maxYield: metadata?.maxYield || 1,
                maxHarvests: metadata?.maxHarvests || 1,
                requiredGardenLevel: metadata?.requiredGardenLevel || 1,
                basePrice:
                  metadata?.price || growFromBaseUnits(entry.account.price),
              },
            };
          })
      );

      if (process.env.NODE_ENV === "development") {
        console.debug("[GrowFi] shop rotation lookup", {
          currentUnixTime: now,
          activeRotationId: rotations.rotationId,
          startsAt: rotations.startsAt,
          endsAt: rotations.endsAt,
          shopItemsLoaded: items.length,
          seedCatalogCount,
        });
      }

      return {
        rotation: {
          id: String(rotations.rotationId),
          rotationId: rotations.rotationId,
          publicKey: rotations.publicKey,
          startsAt: new Date(rotations.startsAt * 1000).toISOString(),
          endsAt: new Date(rotations.endsAt * 1000).toISOString(),
          status: "ACTIVE",
        },
        items,
      };
    },
  });
}

export function useGrowfiMarketplaceListings(enabled = true) {
  const { wallet, program, programId } = useGrowfiClient();
  return useQuery({
    queryKey: [
      "growfi-onchain-marketplace",
      programId.toBase58(),
      wallet.publicKey?.toBase58(),
    ],
    enabled,
    refetchInterval: 20_000,
    queryFn: async () => {
      const accountClients = program.account as unknown as {
        marketplaceListing?: AccountClient<MarketplaceListingAccount>;
      };
      if (!accountClients.marketplaceListing?.all) {
        throw new Error(
          "GrowFi IDL account clients cannot list marketplace listings."
        );
      }

      const walletAddress = wallet.publicKey?.toBase58();
      const allListings = (await accountClients.marketplaceListing.all())
        .map(marketplaceListingToView)
        .sort(
          (a, b) =>
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
      const browseListings = allListings.filter(
        (listing) => listing.status === "ACTIVE"
      );
      const myListings = walletAddress
        ? allListings.filter((listing) => listing.sellerWallet === walletAddress)
        : [];

      if (process.env.NODE_ENV === "development") {
        console.debug("[GrowFi] marketplace on-chain listings loaded", {
          browseListings: browseListings.length,
          myListings: myListings.length,
          connectedSellerWallet: walletAddress || null,
          filters: { browseStatus: "ACTIVE", mySeller: walletAddress || null },
        });
      }

      return { listings: browseListings, myListings, allListings };
    },
  });
}

export function useGrowfiActions() {
  const { connection, wallet, program, programId } = useGrowfiClient();
  const queryClient = useQueryClient();
  const programMethods = program.methods as unknown as ProgramMethods;

  const requireWallet = () => {
    if (!wallet.publicKey || !wallet.signTransaction) {
      throw new Error("Connect a wallet that can sign transactions.");
    }
    return wallet.publicKey;
  };

  const sendInstructions = async (
    label: string,
    instructions: TransactionInstruction[]
  ) => {
    const publicKey = requireWallet();
    const toastId = toast.loading("Preparing transaction", {
      description: label,
    });
    try {
      const latest = await connection.getLatestBlockhash("confirmed");
      const transaction = new Transaction({
        feePayer: publicKey,
        blockhash: latest.blockhash,
        lastValidBlockHeight: latest.lastValidBlockHeight,
      }).add(...instructions);

      toast.loading("Wallet approval", { id: toastId, description: label });
      const signed = await wallet.signTransaction!(transaction);

      toast.loading("Sending transaction", {
        id: toastId,
        description: label,
      });
      const signature = await connection.sendRawTransaction(
        signed.serialize(),
        {
          skipPreflight: false,
        }
      );
      toast.loading("Confirming transaction", {
        id: toastId,
        description: `${label}: ${shortSignature(signature)}`,
      });
      await connection.confirmTransaction(
        { ...latest, signature },
        "confirmed"
      );

      toast.success("Transaction confirmed", {
        id: toastId,
        description: `${label}: ${shortSignature(signature)}`,
        action: {
          label: "Explorer",
          onClick: () => window.open(explorerUrl(signature), "_blank"),
        },
      });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["growfi-onchain-state"] }),
        queryClient.invalidateQueries({ queryKey: ["growfi-onchain-shop"] }),
        queryClient.invalidateQueries({
          queryKey: ["growfi-onchain-marketplace"],
        }),
        queryClient.invalidateQueries({ queryKey: ["garden"] }),
        queryClient.invalidateQueries({ queryKey: ["inventory"] }),
        queryClient.invalidateQueries({ queryKey: ["shop"] }),
        queryClient.invalidateQueries({ queryKey: ["me"] }),
        queryClient.invalidateQueries({ queryKey: ["wallet-balances"] }),
      ]);
      return signature;
    } catch (error) {
      const sendError = error as {
        logs?: string[];
        getLogs?: (connection?: unknown) => Promise<string[]>;
      };
      if (process.env.NODE_ENV === "development") {
        if (sendError.logs?.length) {
          console.error("[GrowFi] transaction logs", sendError.logs);
        } else if (typeof sendError.getLogs === "function") {
          sendError
            .getLogs(connection)
            .then((logs) => console.error("[GrowFi] transaction logs", logs))
            .catch(() => undefined);
        }
      }
      toast.error("Transaction failed", {
        id: toastId,
        description: decodeGrowfiError(error),
      });
      throw error;
    }
  };

  const getConfig = async () => {
    const [configPda] = growfiPdas.config(programId);
    const config = await fetchNullable(program, "config", configPda);
    if (!config) {
      throw new Error("GrowFi config is not initialized on devnet.");
    }
    return { publicKey: configPda, account: config as ConfigAccount };
  };

  const getTokenProgram = async (mint: PublicKey) => {
    const account = await connection.getAccountInfo(mint, "confirmed");
    if (!account) {
      throw new Error("Configured $GROW mint was not found on devnet.");
    }
    if (
      account.owner.equals(TOKEN_PROGRAM_ID) ||
      account.owner.equals(TOKEN_2022_PROGRAM_ID)
    ) {
      return account.owner;
    }
    throw new Error("Configured $GROW mint is not an SPL token mint.");
  };

  const getGrowAta = async (
    mint: PublicKey,
    owner: PublicKey,
    payer: PublicKey,
    tokenProgram: PublicKey
  ) => {
    const ata = getAssociatedTokenAddressSync(
      mint,
      owner,
      true,
      tokenProgram,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const existing = await connection.getAccountInfo(ata, "confirmed");
    if (existing) {
      return { ata, instruction: null as TransactionInstruction | null };
    }
    return {
      ata,
      instruction: createAssociatedTokenAccountInstruction(
        payer,
        ata,
        owner,
        mint,
        tokenProgram,
        ASSOCIATED_TOKEN_PROGRAM_ID
      ),
    };
  };
  const getUserGrowAta = async (
    mint: PublicKey,
    owner: PublicKey,
    tokenProgram: PublicKey
  ) => getGrowAta(mint, owner, owner, tokenProgram);

  const resolveGrowMint = (config: ConfigAccount) =>
    getGrowTokenMint() || config.growMint;

  return {
    async createPlayer() {
      const authority = requireWallet();
      const [config] = growfiPdas.config(programId);
      const [player] = growfiPdas.player(authority, programId);
      const [seedInventory] = growfiPdas.seedInventory(authority, programId);
      const [fruitInventory] = growfiPdas.fruitInventory(authority, programId);
      const [decorationInventory] = growfiPdas.decorationInventory(
        authority,
        programId
      );
      const transaction = await programMethods
        .createPlayer(zeroHash(), zeroHash())
        .accounts({
          config,
          player,
          seedInventory,
          fruitInventory,
          decorationInventory,
          authority,
          systemProgram: SystemProgram.programId,
        })
        .transaction();
      return sendInstructions("Create player", transaction.instructions);
    },

    async createFarmWithInitialPlots(options?: {
      onProgress?: (message: string) => void;
    }) {
      const authority = requireWallet();
      const [config] = growfiPdas.config(programId);
      const [player] = growfiPdas.player(authority, programId);
      const [farm] = growfiPdas.farm(authority, programId);
      const farmExists = await fetchNullable(program, "farm", farm);
      const farmInstructions: TransactionInstruction[] = [];
      if (!farmExists) {
        const farmTx = await programMethods
          .createFarm()
          .accounts({
            config,
            player,
            farm,
            owner: authority,
            authority,
            systemProgram: SystemProgram.programId,
          })
          .transaction();
        farmInstructions.push(...farmTx.instructions);
      }
      const plotInstructions: TransactionInstruction[] = [];
      for (let y = 0; y < 4; y += 1) {
        for (let x = 0; x < 4; x += 1) {
          const [plot] = growfiPdas.plot(farm, x, y, programId);
          const existing = await fetchNullable(program, "plot", plot);
          if (existing) {
            continue;
          }
          const tx = await programMethods
            .createInitialPlots(x, y)
            .accounts({
              config,
              farm,
              plot,
              owner: authority,
              authority,
              systemProgram: SystemProgram.programId,
            })
            .transaction();
          plotInstructions.push(...tx.instructions);
        }
      }

      const signatures: string[] = [];
      const chunks: TransactionInstruction[][] = [];
      const plotChunkSize = 8;
      const firstChunk = [
        ...farmInstructions,
        ...plotInstructions.splice(0, plotChunkSize),
      ];
      if (firstChunk.length) {
        chunks.push(firstChunk);
      }
      while (plotInstructions.length > 0) {
        chunks.push(plotInstructions.splice(0, plotChunkSize));
      }

      for (let index = 0; index < chunks.length; index += 1) {
        const label =
          index === 0 && farmInstructions.length
            ? "Create farm and initial plots"
            : `Create initial plots ${index + 1}/${chunks.length}`;
        options?.onProgress?.(
          `Initializing farm... Step ${index + 1}/${chunks.length}`
        );
        signatures.push(await sendInstructions(label, chunks[index]));
      }
      return signatures;
    },

    async buySeed(input: {
      rotationId: number;
      seedId: number;
      quantity?: number;
    }) {
      const buyer = requireWallet();
      const { publicKey: config, account: configAccount } = await getConfig();
      const growMint = resolveGrowMint(configAccount);
      const tokenProgram = await getTokenProgram(growMint);
      const { ata: buyerGrowAta, instruction } = await getUserGrowAta(
        growMint,
        buyer,
        tokenProgram
      );
      const [player] = growfiPdas.player(buyer, programId);
      const [seedInventory] = growfiPdas.seedInventory(buyer, programId);
      const [shopRotation] = growfiPdas.shopRotation(
        input.rotationId,
        programId
      );
      const [shopItem] = growfiPdas.shopItem(
        input.rotationId,
        input.seedId,
        programId
      );
      const [seedCatalog] = growfiPdas.seedCatalog(input.seedId, programId);
      const [shopPurchase] = growfiPdas.shopPurchase(
        buyer,
        input.rotationId,
        input.seedId,
        programId
      );
      const transaction = await programMethods
        .buySeed(
          asBn(input.rotationId),
          asBn(input.seedId),
          asBn(input.quantity || 1)
        )
        .accounts({
          config,
          player,
          seedInventory,
          shopRotation,
          shopItem,
          seedCatalog,
          shopPurchase,
          buyer,
          growMint,
          buyerGrowAta,
          treasuryVault: configAccount.treasuryVault,
          tokenProgram,
          systemProgram: SystemProgram.programId,
        })
        .transaction();
      return sendInstructions("Buy seed", [
        ...(instruction ? [instruction] : []),
        ...transaction.instructions,
      ]);
    },

    async plantSeed(input: {
      x: number;
      y: number;
      seed: Partial<SeedView> | number | string;
    }) {
      const authority = requireWallet();
      const seed = findOnchainSeed(input.seed);
      if (!seed) {
        throw new Error(
          "Could not match that seed to an on-chain SeedCatalog account."
        );
      }
      const [config] = growfiPdas.config(programId);
      const [player] = growfiPdas.player(authority, programId);
      const [seedInventory] = growfiPdas.seedInventory(authority, programId);
      const [seedCatalog] = growfiPdas.seedCatalog(seed.seedId, programId);
      const [farm] = growfiPdas.farm(authority, programId);
      const [plot] = growfiPdas.plot(farm, input.x, input.y, programId);
      const transaction = await programMethods
        .plantSeed()
        .accounts({
          config,
          player,
          seedInventory,
          seedCatalog,
          farm,
          plot,
          authority,
        })
        .transaction();
      return sendInstructions("Plant seed", transaction.instructions);
    },

    async waterPlant(input: { x: number; y: number }) {
      const authority = requireWallet();
      const [config] = growfiPdas.config(programId);
      const [player] = growfiPdas.player(authority, programId);
      const [farm] = growfiPdas.farm(authority, programId);
      const [plot] = growfiPdas.plot(farm, input.x, input.y, programId);
      const transaction = await programMethods
        .waterPlant()
        .accounts({
          config,
          player,
          farm,
          plot,
          authority,
        })
        .transaction();
      return sendInstructions("Water plant", transaction.instructions);
    },

    async harvestPlant(input: {
      x: number;
      y: number;
      seed?: Partial<SeedView> | number | string;
    }) {
      const authority = requireWallet();
      const [config] = growfiPdas.config(programId);
      const [player] = growfiPdas.player(authority, programId);
      const [fruitInventory] = growfiPdas.fruitInventory(authority, programId);
      const [farm] = growfiPdas.farm(authority, programId);
      const [plot] = growfiPdas.plot(farm, input.x, input.y, programId);
      const plotAccount = (await fetchNullable(
        program,
        "plot",
        plot
      )) as PlotAccount | null;
      const seed = findOnchainSeed(
        input.seed || bnToNumber(plotAccount?.seedId || 0)
      );
      if (!seed) {
        throw new Error(
          "Could not match this plot's seed to an on-chain SeedCatalog account."
        );
      }
      const [seedCatalog] = growfiPdas.seedCatalog(seed.seedId, programId);
      const transaction = await programMethods
        .harvestPlant()
        .accounts({
          config,
          player,
          fruitInventory,
          seedCatalog,
          farm,
          plot,
          authority,
        })
        .transaction();
      return sendInstructions("Harvest plant", transaction.instructions);
    },

    async sellFruit(input: {
      fruit: Partial<FruitView> | number | string;
      mutation: Mutation;
      quantity?: number;
    }) {
      const authority = requireWallet();
      const quantity = input.quantity ?? 1;
      if (!Number.isInteger(quantity) || quantity < 1) {
        throw new Error("Enter at least 1 fruit.");
      }
      const seed = findOnchainSeed(input.fruit);
      if (!seed) {
        throw new Error(
          "Could not match that fruit to an on-chain SeedCatalog account."
        );
      }
      const { publicKey: config, account: configAccount } = await getConfig();
      const growMint = resolveGrowMint(configAccount);
      const tokenProgram = await getTokenProgram(growMint);
      const { ata: userGrowAta, instruction } = await getUserGrowAta(
        growMint,
        authority,
        tokenProgram
      );
      const [fruitInventory] = growfiPdas.fruitInventory(authority, programId);
      const fruitInventoryAccount = (await fetchNullable(
        program,
        "fruitInventory",
        fruitInventory
      )) as FruitInventoryAccount | null;
      const ownedFruit = fruitInventoryAccount?.balances.find(
        (balance) =>
          bnToNumber(balance.fruitId) === seed.fruitId &&
          mutationFromOnchain(balance.mutation) === input.mutation
      );
      const ownedQty = bnToNumber(ownedFruit?.amount || 0);
      const lockedQty = bnToNumber(ownedFruit?.lockedAmount || 0);
      const availableQty = ownedQty - lockedQty;
      if (process.env.NODE_ENV === "development") {
        console.debug("[GrowFi] sell fruit on-chain validation", {
          fruitId: seed.fruitId,
          seedId: seed.seedId,
          mutation: input.mutation,
          ownedQty,
          lockedQty,
          amount: quantity,
        });
      }
      if (quantity > availableQty) {
        throw new Error(`You only have ${Math.max(0, availableQty)} available.`);
      }

      const treasuryBalance = await connection
        .getTokenAccountBalance(configAccount.treasuryVault, "confirmed")
        .catch(() => null);
      const estimatedPayoutRaw =
        (BigInt(seed.baseSellPrice) *
          BigInt(GROW_BASE_UNITS) *
          MUTATION_MULTIPLIER_BPS[input.mutation] *
          BigInt(quantity)) /
        10_000n;
      if (!treasuryBalance) {
        throw new Error("Treasury has insufficient $GROW for system buyback.");
      }
      if (BigInt(treasuryBalance.value.amount || "0") < estimatedPayoutRaw) {
        throw new Error("Treasury has insufficient $GROW for system buyback.");
      }
      const [seedCatalog] = growfiPdas.seedCatalog(seed.seedId, programId);
      const mutation = enumVariant(MUTATION_VARIANTS[input.mutation]);
      const transaction = await programMethods
        .sellFruitToSystem(mutation, asBn(quantity))
        .accounts({
          config,
          fruitInventory,
          seedCatalog,
          authority,
          growMint,
          userGrowAta,
          treasuryVault: configAccount.treasuryVault,
          tokenProgram,
        })
        .transaction();
      return sendInstructions("Sell fruit", [
        ...(instruction ? [instruction] : []),
        ...transaction.instructions,
      ]);
    },

    async upgradeFarm() {
      const authority = requireWallet();
      const { publicKey: config, account: configAccount } = await getConfig();
      const growMint = resolveGrowMint(configAccount);
      const tokenProgram = await getTokenProgram(growMint);
      const { ata: userGrowAta, instruction } = await getUserGrowAta(
        growMint,
        authority,
        tokenProgram
      );
      const [player] = growfiPdas.player(authority, programId);
      const [farm] = growfiPdas.farm(authority, programId);
      const transaction = await programMethods
        .upgradeFarm()
        .accounts({
          config,
          player,
          farm,
          authority,
          growMint,
          userGrowAta,
          treasuryVault: configAccount.treasuryVault,
          tokenProgram,
        })
        .transaction();
      return sendInstructions("Upgrade farm", [
        ...(instruction ? [instruction] : []),
        ...transaction.instructions,
      ]);
    },

    async createListing(input: {
      fruit: Partial<FruitView> | number | string;
      mutation: Mutation;
      quantity: number;
      price: number;
    }) {
      const seller = requireWallet();
      if (!Number.isInteger(input.quantity) || input.quantity < 1) {
        throw new Error("Enter at least 1 fruit.");
      }
      if (!Number.isFinite(input.price) || input.price <= 0) {
        throw new Error("Enter a price greater than 0.");
      }
      const seed = findOnchainSeed(input.fruit);
      if (!seed) {
        throw new Error("Could not match that fruit to an on-chain fruit id.");
      }
      const [config] = growfiPdas.config(programId);
      const [fruitInventory] = growfiPdas.fruitInventory(seller, programId);
      const fruitInventoryAccount = (await fetchNullable(
        program,
        "fruitInventory",
        fruitInventory
      )) as FruitInventoryAccount | null;
      const ownedFruit = fruitInventoryAccount?.balances.find(
        (balance) =>
          bnToNumber(balance.fruitId) === seed.fruitId &&
          mutationFromOnchain(balance.mutation) === input.mutation
      );
      const ownedQty = bnToNumber(ownedFruit?.amount || 0);
      const lockedQty = bnToNumber(ownedFruit?.lockedAmount || 0);
      const availableQty = ownedQty - lockedQty;
      if (process.env.NODE_ENV === "development") {
        console.debug("[GrowFi] marketplace create listing validation", {
          fruitId: seed.fruitId,
          mutation: input.mutation,
          ownedQty,
          lockedQty,
          amount: input.quantity,
          price: input.price,
        });
      }
      if (input.quantity > availableQty) {
        throw new Error(`You only have ${Math.max(0, availableQty)} available.`);
      }
      const listingId = Date.now();
      const [listing] = growfiPdas.marketplaceListing(
        seller,
        listingId,
        programId
      );
      const expiresAt = Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60;
      const mutation = enumVariant(MUTATION_VARIANTS[input.mutation]);
      const rawPrice = BigInt(Math.round(input.price * GROW_BASE_UNITS));
      const transaction = await programMethods
        .createListing(
          asBn(listingId),
          asBn(seed.fruitId),
          mutation,
          asBn(input.quantity),
          asBn(rawPrice),
          asBn(expiresAt)
        )
        .accounts({
          config,
          fruitInventory,
          listing,
          seller,
          systemProgram: SystemProgram.programId,
        })
        .transaction();
      const signature = await sendInstructions(
        "Create marketplace listing",
        transaction.instructions
      );
      if (process.env.NODE_ENV === "development") {
        console.debug("[GrowFi] marketplace listing created", {
          signature,
          listingPda: listing.toBase58(),
          listingId,
        });
      }
      return {
        signature,
        listingPda: listing.toBase58(),
        listingId,
      };
    },

    async cancelListing(input: { address: string }) {
      const seller = requireWallet();
      const listing = new PublicKey(input.address);
      const listingAccount = (await fetchNullable(
        program,
        "marketplaceListing",
        listing
      )) as MarketplaceListingAccount | null;
      if (!listingAccount) {
        throw new Error("That marketplace listing was not found on-chain.");
      }
      if (!listingAccount.seller.equals(seller)) {
        throw new Error("Only the seller can cancel this listing.");
      }
      const [config] = growfiPdas.config(programId);
      const [fruitInventory] = growfiPdas.fruitInventory(seller, programId);
      const transaction = await programMethods
        .cancelListing()
        .accounts({
          config,
          fruitInventory,
          listing,
          seller,
        })
        .transaction();
      return sendInstructions("Cancel marketplace listing", transaction.instructions);
    },

    async buyListing(input: { address: string }) {
      const buyer = requireWallet();
      const listing = new PublicKey(input.address);
      const listingAccount = (await fetchNullable(
        program,
        "marketplaceListing",
        listing
      )) as MarketplaceListingAccount | null;
      if (!listingAccount) {
        throw new Error("That marketplace listing was not found on-chain.");
      }
      if (listingAccount.seller.equals(buyer)) {
        throw new Error("You cannot buy your own listing.");
      }
      const { publicKey: config, account: configAccount } = await getConfig();
      const growMint = resolveGrowMint(configAccount);
      const tokenProgram = await getTokenProgram(growMint);
      const { ata: buyerGrowAta, instruction: buyerAtaIx } =
        await getUserGrowAta(growMint, buyer, tokenProgram);
      const { ata: sellerGrowAta, instruction: sellerAtaIx } =
        await getGrowAta(growMint, listingAccount.seller, buyer, tokenProgram);
      const [sellerFruitInventory] = growfiPdas.fruitInventory(
        listingAccount.seller,
        programId
      );
      const [buyerFruitInventory] = growfiPdas.fruitInventory(buyer, programId);
      const transaction = await programMethods
        .buyListing()
        .accounts({
          config,
          listing,
          sellerFruitInventory,
          buyerFruitInventory,
          buyer,
          seller: listingAccount.seller,
          growMint,
          buyerGrowAta,
          sellerGrowAta,
          treasuryVault: configAccount.treasuryVault,
          tokenProgram,
        })
        .transaction();
      return sendInstructions("Buy marketplace listing", [
        ...(buyerAtaIx ? [buyerAtaIx] : []),
        ...(sellerAtaIx ? [sellerAtaIx] : []),
        ...transaction.instructions,
      ]);
    },

    plotStateName(value: unknown) {
      return variantName(value);
    },
  };
}
