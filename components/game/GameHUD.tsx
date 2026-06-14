"use client";

import { memo } from "react";
import {
  Backpack,
  Droplets,
  Hand,
  Handshake,
  HelpCircle,
  Home,
  MapPin,
  Menu,
  ShoppingBasket,
  Sprout,
  Store,
  User,
  Users,
  Wallet,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { ProgressionPanel } from "@/components/game/ProgressionPanel";
import { BalanceCard } from "@/components/game/shared/BalanceCard";
import { CountdownBadge } from "@/components/game/shared/CountdownBadge";
import { StaminaBar } from "@/components/game/shared/StaminaBar";
import {
  gameEventBus,
  type GameArea,
  type GameOverlayKey,
} from "@/lib/game/eventBus";
import {
  clientGrowMintFromConfig,
  useWalletBalances,
} from "@/lib/solana/useWalletBalances";
import { useGrowfiOnchainState } from "@/lib/solana/useGrowfiProgram";
import type { GardenResponse } from "@/types/game-data";

const quickActions: Array<{
  overlay: GameOverlayKey;
  label: string;
  icon: typeof Backpack;
}> = [
  { overlay: "inventory", label: "Inventory", icon: Backpack },
  { overlay: "seedShop", label: "Seed Shop", icon: ShoppingBasket },
  { overlay: "marketplace", label: "Market", icon: Store },
  { overlay: "wallet", label: "Wallet", icon: Wallet },
  { overlay: "trade", label: "Trade", icon: Handshake },
  { overlay: "farmUpgrade", label: "Farm", icon: Sprout },
  { overlay: "onlinePlayers", label: "Online Players", icon: Users },
];

export const GameHUD = memo(function GameHUD({
  garden,
  area,
  shopEndsAt,
  ownerName,
  visitorMode,
  onlineCount,
}: {
  garden?: GardenResponse;
  area: GameArea;
  shopEndsAt?: string;
  ownerName?: string;
  visitorMode?: boolean;
  onlineCount?: number;
}) {
  const user = garden?.user;
  const onchain = useGrowfiOnchainState();
  const balances = useWalletBalances({
    mintAddress: clientGrowMintFromConfig(onchain.data?.config),
  });
  const walletGrowBalance = balances.data?.grow?.balance;

  return (
    <TooltipProvider>
      <div className="pointer-events-none absolute inset-x-0 top-0 z-30 p-3 md:p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="pointer-events-auto flex flex-col gap-3 md:max-w-[420px]">
            <div className="pixel-hud flex items-center gap-3 p-3">
              <Avatar className="h-10 w-10 rounded-none border-2 border-[#0a0f0d]">
                <AvatarImage src={user?.avatarUrl || undefined} />
                <AvatarFallback className="rounded-none bg-[#153d21] text-[#91d985]">
                  {(user?.username || "F").slice(0, 1).toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <div className="truncate font-sans font-bold text-[#f2fbf1]">
                  {user?.username || "Farmer"}
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <span className="pixel-badge gap-1 text-[#91d985]">
                    <MapPin className="h-3 w-3" />
                    {visitorMode && ownerName ? ownerName : area}
                  </span>
                  {visitorMode ? (
                    <span className="pixel-badge text-[#8ad4ff]">read-only</span>
                  ) : null}
                  <span className="pixel-badge gap-1 text-[#5e8c52]">
                    <Users className="h-3 w-3" />
                    {onlineCount ?? 1}
                  </span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-2 md:grid-cols-[150px_220px]">
              <BalanceCard
                balance={walletGrowBalance ?? user?.availableGrow ?? 0}
                locked={undefined}
              />
              <div className="pixel-hud space-y-2 p-3">
                <StaminaBar
                  stamina={user?.stamina ?? 0}
                  maxStamina={user?.maxStamina ?? 100}
                />
                <div className="flex flex-wrap gap-1">
                  <CountdownBadge to={shopEndsAt} label="Shop" />
                  <span className="pixel-badge gap-1 text-[#8ad4ff]">
                    <Droplets className="h-3 w-3" />
                    {user?.waterCharges ?? 0}/{user?.maxWaterCharges ?? 20}
                  </span>
                </div>
              </div>
            </div>
            <div className="hidden md:block">
              <ProgressionPanel garden={garden} compact />
            </div>
            {visitorMode ? (
              <div className="pixel-hud space-y-2 p-3">
                <div className="pixel-heading text-xs text-[#f2fbf1]">
                  Viewing {ownerName || "another farmer"}&apos;s Farm
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    className="pixel-btn pixel-btn-ghost px-3 py-2"
                    onClick={() => gameEventBus.emit("returnHome")}
                  >
                    <Home className="h-4 w-4" />
                    MY FARM
                  </button>
                  <button
                    type="button"
                    className="pixel-btn pixel-btn-ghost px-3 py-2"
                    onClick={() => gameEventBus.emit("goTown")}
                  >
                    <MapPin className="h-4 w-4" />
                    TOWN
                  </button>
                </div>
              </div>
            ) : null}
          </div>

          <div className="pointer-events-auto hidden items-center gap-2 md:flex">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Tooltip key={action.overlay}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="pixel-hud grid h-10 w-10 place-items-center text-[#91d985] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:text-[#f7d767]"
                      onClick={() =>
                        gameEventBus.emit("openOverlay", {
                          overlay: action.overlay,
                        })
                      }
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent className="border-2 border-[#3d9f4b] bg-[#0a0f0d] font-sans text-[#ddf5d9]">
                    {action.label}
                  </TooltipContent>
                </Tooltip>
              );
            })}
            <button
              type="button"
              className="pixel-btn pixel-btn-primary px-4 py-2"
              onClick={() => gameEventBus.emit("interact")}
            >
              <Hand className="h-4 w-4" />
              INTERACT
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="pixel-hud grid h-10 w-10 place-items-center text-[#91d985] hover:text-[#f7d767]"
                >
                  <Menu className="h-4 w-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="border-2 border-[#3d9f4b] bg-[#0d2614] font-sans text-[#ddf5d9]"
              >
                <DropdownMenuItem
                  className="focus:bg-[#153d21] focus:text-[#f7d767]"
                  onClick={() =>
                    gameEventBus.emit("openOverlay", { overlay: "tutorial" })
                  }
                >
                  <HelpCircle className="mr-2 h-4 w-4" />
                  Tutorial
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="focus:bg-[#153d21] focus:text-[#f7d767]"
                  onClick={() =>
                    gameEventBus.emit("openOverlay", { overlay: "questBoard" })
                  }
                >
                  <Sprout className="mr-2 h-4 w-4" />
                  Daily Quests
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="focus:bg-[#153d21] focus:text-[#f7d767]"
                  onClick={() =>
                    gameEventBus.emit("openOverlay", { overlay: "profile" })
                  }
                >
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="focus:bg-[#153d21] focus:text-[#f7d767]"
                  onClick={() =>
                    gameEventBus.emit("openOverlay", { overlay: "activityLog" })
                  }
                >
                  <Home className="mr-2 h-4 w-4" />
                  Mailbox &amp; Activity
                </DropdownMenuItem>
                {visitorMode ? (
                  <DropdownMenuItem
                    className="focus:bg-[#153d21] focus:text-[#f7d767]"
                    onClick={() => gameEventBus.emit("returnHome")}
                  >
                    <Home className="mr-2 h-4 w-4" />
                    Return Home
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
});
