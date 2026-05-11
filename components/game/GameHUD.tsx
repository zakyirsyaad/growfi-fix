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
  Wallet
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ProgressionPanel } from "@/components/game/ProgressionPanel";
import { BalanceCard } from "@/components/game/shared/BalanceCard";
import { CountdownBadge } from "@/components/game/shared/CountdownBadge";
import { StaminaBar } from "@/components/game/shared/StaminaBar";
import { gameEventBus, type GameArea, type GameOverlayKey } from "@/lib/game/eventBus";
import {
  clientGrowMintFromConfig,
  useWalletBalances,
} from "@/lib/solana/useWalletBalances";
import { useGrowfiOnchainState } from "@/lib/solana/useGrowfiProgram";
import type { GardenResponse } from "@/types/game-data";

const quickActions: Array<{ overlay: GameOverlayKey; label: string; icon: typeof Backpack }> = [
  { overlay: "inventory", label: "Inventory", icon: Backpack },
  { overlay: "seedShop", label: "Seed Shop", icon: ShoppingBasket },
  { overlay: "marketplace", label: "Market", icon: Store },
  { overlay: "wallet", label: "Wallet", icon: Wallet },
  { overlay: "trade", label: "Trade", icon: Handshake },
  { overlay: "farmUpgrade", label: "Farm", icon: Sprout },
  { overlay: "onlinePlayers", label: "Online Players", icon: Users }
];

export const GameHUD = memo(function GameHUD({
  garden,
  area,
  shopEndsAt,
  ownerName,
  visitorMode,
  onlineCount
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
            <Card className="bg-white/88 shadow-sm backdrop-blur">
              <CardContent className="flex items-center gap-3 p-3">
                <Avatar className="h-10 w-10 rounded-md">
                  <AvatarImage src={user?.avatarUrl || undefined} />
                  <AvatarFallback className="rounded-md bg-leaf-100 text-leaf-900">
                    {(user?.username || "F").slice(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-bold">{user?.username || "Farmer"}</div>
                  <div className="flex flex-wrap gap-1">
                    <Badge variant="outline" className="gap-1 bg-white/75">
                      <MapPin className="h-3.5 w-3.5" />
                      {visitorMode && ownerName ? ownerName : area}
                    </Badge>
                    {visitorMode ? <Badge variant="secondary">read-only visit</Badge> : null}
                    <Badge variant="outline" className="gap-1 bg-white/75">
                      <Users className="h-3.5 w-3.5" />
                      Online in area: {onlineCount ?? 1}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
            <div className="grid grid-cols-[140px_minmax(0,1fr)] gap-2 md:grid-cols-[150px_220px]">
              <BalanceCard
                balance={walletGrowBalance ?? user?.availableGrow ?? 0}
                locked={undefined}
              />
              <Card className="bg-white/88">
                <CardContent className="space-y-2 p-3">
                  <StaminaBar stamina={user?.stamina ?? 0} maxStamina={user?.maxStamina ?? 100} />
                  <div className="flex flex-wrap gap-1">
                    <CountdownBadge to={shopEndsAt} label="Shop" />
                    <Badge variant="outline" className="gap-1 bg-white/75">
                      <Droplets className="h-3.5 w-3.5" />
                      {user?.waterCharges ?? 0}/{user?.maxWaterCharges ?? 20}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            </div>
            <div className="hidden md:block">
              <ProgressionPanel garden={garden} compact />
            </div>
            {visitorMode ? (
              <Card className="bg-white/90 shadow-sm backdrop-blur">
                <CardContent className="space-y-2 p-3">
                  <div className="text-sm font-black">
                    Viewing {ownerName || "another farmer"}&apos;s Farm
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => gameEventBus.emit("returnHome")}
                    >
                      <Home className="h-4 w-4" />
                      Back to My Farm
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => gameEventBus.emit("goTown")}
                    >
                      <MapPin className="h-4 w-4" />
                      Go to Town
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : null}
          </div>

          <div className="pointer-events-auto hidden items-center gap-2 md:flex">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Tooltip key={action.overlay}>
                  <TooltipTrigger asChild>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="bg-white/88 shadow-sm"
                      onClick={() => gameEventBus.emit("openOverlay", { overlay: action.overlay })}
                    >
                      <Icon className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>{action.label}</TooltipContent>
                </Tooltip>
              );
            })}
            <Button className="bg-primary/95 shadow-sm" onClick={() => gameEventBus.emit("interact")}>
              <Hand className="h-4 w-4" />
              Interact
            </Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="icon" className="bg-white/88 shadow-sm">
                  <Menu className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => gameEventBus.emit("openOverlay", { overlay: "tutorial" })}>
                  <HelpCircle className="mr-2 h-4 w-4" />
                  Tutorial
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => gameEventBus.emit("openOverlay", { overlay: "questBoard" })}>
                  <Sprout className="mr-2 h-4 w-4" />
                  Daily Quests
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => gameEventBus.emit("openOverlay", { overlay: "profile" })}>
                  <User className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => gameEventBus.emit("openOverlay", { overlay: "activityLog" })}>
                  <Home className="mr-2 h-4 w-4" />
                  Mailbox & Activity
                </DropdownMenuItem>
                {visitorMode ? (
                  <DropdownMenuItem onClick={() => gameEventBus.emit("returnHome")}>
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
