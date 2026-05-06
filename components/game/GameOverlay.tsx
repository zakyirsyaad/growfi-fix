"use client";

import { useEffect, useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { GameHUD } from "@/components/game/GameHUD";
import { InteractionPrompt } from "@/components/game/InteractionPrompt";
import { MobileControls } from "@/components/game/MobileControls";
import { ActivityLogOverlay } from "@/components/game/overlays/ActivityLogOverlay";
import { InventoryOverlay } from "@/components/game/overlays/InventoryOverlay";
import { LeaderboardOverlay } from "@/components/game/overlays/LeaderboardOverlay";
import { MarketplaceOverlay } from "@/components/game/overlays/MarketplaceOverlay";
import { ProfileOverlay } from "@/components/game/overlays/ProfileOverlay";
import { SeedSelectModal } from "@/components/game/overlays/SeedSelectModal";
import { SeedShopOverlay } from "@/components/game/overlays/SeedShopOverlay";
import { TradeOverlay } from "@/components/game/overlays/TradeOverlay";
import { VisitFarmOverlay } from "@/components/game/overlays/VisitFarmOverlay";
import { WalletOverlay } from "@/components/game/overlays/WalletOverlay";
import { FarmUpgradeOverlay } from "@/components/game/overlays/FarmUpgradeOverlay";
import { OnlinePlayersOverlay } from "@/components/game/overlays/OnlinePlayersOverlay";
import { PlayerInteractionOverlay } from "@/components/game/overlays/PlayerInteractionOverlay";
import { QuestBoardOverlay } from "@/components/game/overlays/QuestBoardOverlay";
import { gameEventBus, type GameArea, type GameOverlayKey } from "@/lib/game/eventBus";
import { apiFetch } from "@/lib/utils/fetcher";
import type { OnlinePlayer } from "@/lib/realtime/types";
import type { GardenResponse } from "@/types/game-data";

type OverlayState = Partial<Record<GameOverlayKey, boolean>>;

export function GameOverlay({
  garden,
  shopEndsAt
}: {
  garden?: GardenResponse;
  shopEndsAt?: string;
}) {
  const queryClient = useQueryClient();
  const [overlays, setOverlays] = useState<OverlayState>({});
  const [payloads, setPayloads] = useState<Partial<Record<GameOverlayKey, unknown>>>({});
  const [selectedPlotId, setSelectedPlotId] = useState<string | null>(null);
  const [selectedPlotVisitorMode, setSelectedPlotVisitorMode] = useState(false);
  const [prompt, setPrompt] = useState<{ visible: boolean; label?: string }>({ visible: false });
  const [area, setArea] = useState<GameArea>("Home Farm");
  const [ownerName, setOwnerName] = useState<string | undefined>();
  const [visitorMode, setVisitorMode] = useState(false);
  const [onlinePlayers, setOnlinePlayers] = useState<OnlinePlayer[]>([]);
  const [currentRoom, setCurrentRoom] = useState("farm:unknown");

  const refreshGameQueries = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["garden"] }),
      queryClient.invalidateQueries({ queryKey: ["inventory"] }),
      queryClient.invalidateQueries({ queryKey: ["me"] }),
      queryClient.invalidateQueries({ queryKey: ["quests"] })
    ]);
  };

  const refillWaterMutation = useMutation({
    mutationFn: () => apiFetch("/api/garden/refill-water", { method: "POST" }),
    onSuccess: async () => {
      toast.success("Watering can refilled");
      await refreshGameQueries();
    },
    onError: (err) => {
      toast.error("Could not refill water", {
        description: err instanceof Error ? err.message : "Try again at the well."
      });
    }
  });

  useEffect(() => {
    return gameEventBus.on("openOverlay", ({ overlay, payload }) => {
      setPayloads((current) => ({ ...current, [overlay]: payload }));
      setOverlays((current) => ({ ...current, [overlay]: true }));
    });
  }, []);

  useEffect(() => {
    return gameEventBus.on("closeOverlay", ({ overlay }) => {
      if (overlay) {
        setOverlays((current) => ({ ...current, [overlay]: false }));
      } else {
        setOverlays({});
      }
    });
  }, []);

  useEffect(() => {
    return gameEventBus.on("selectPlot", ({ plotId, visitorMode: isVisitor }) => {
      setSelectedPlotId(plotId);
      setSelectedPlotVisitorMode(!!isVisitor);
      setOverlays((current) => ({ ...current, seedSelect: true }));
    });
  }, []);

  useEffect(() => {
    return gameEventBus.on("interactionPrompt", ({ visible, label }) => {
      setPrompt({ visible, label });
    });
  }, []);

  useEffect(() => {
    return gameEventBus.on("areaChanged", ({ area: nextArea, ownerName: nextOwner, visitorMode: isVisitor }) => {
      setArea(nextArea);
      setOwnerName(nextOwner);
      setVisitorMode(!!isVisitor);
    });
  }, []);

  useEffect(() => {
    return gameEventBus.on("actionToast", ({ title, description, variant }) => {
      if (variant === "error") {
        toast.error(title, { description });
      } else {
        toast(title, { description });
      }
    });
  }, []);

  useEffect(() => {
    return gameEventBus.on("refreshFarmState", () => {
      refreshGameQueries();
    });
  }, []);

  useEffect(() => {
    return gameEventBus.on("refillWater", () => {
      if (!refillWaterMutation.isPending) {
        refillWaterMutation.mutate();
      }
    });
  }, [refillWaterMutation]);

  useEffect(() => {
    return gameEventBus.on("roomPlayersUpdated", ({ players, room }) => {
      setOnlinePlayers(players);
      setCurrentRoom(room);
    });
  }, []);

  useEffect(() => {
    return gameEventBus.on("tradeInviteReceived", (invite) => {
      setPayloads((current) => ({ ...current, trade: { recipientId: invite.from.userId, recipientUsername: invite.from.username } }));
      toast(`${invite.from.username} invited you to trade`, {
        action: {
          label: "Open",
          onClick: () => setOverlays((current) => ({ ...current, trade: true }))
        }
      });
    });
  }, []);

  const setOverlay = (overlay: GameOverlayKey, open: boolean) => {
    setOverlays((current) => ({ ...current, [overlay]: open }));
  };

  const shared = useMemo(
    () => ({
      garden,
      area,
      ownerName,
      visitorMode,
      shopEndsAt
    }),
    [area, garden, ownerName, shopEndsAt, visitorMode]
  );

  return (
    <>
      <GameHUD {...shared} />
      <InteractionPrompt visible={prompt.visible} label={prompt.label} />
      <MobileControls />

      <SeedSelectModal
        open={!!overlays.seedSelect}
        onOpenChange={(open) => setOverlay("seedSelect", open)}
        garden={garden}
        plotId={selectedPlotId}
        visitorMode={selectedPlotVisitorMode}
      />
      <InventoryOverlay open={!!overlays.inventory} onOpenChange={(open) => setOverlay("inventory", open)} />
      <SeedShopOverlay open={!!overlays.seedShop} onOpenChange={(open) => setOverlay("seedShop", open)} />
      <MarketplaceOverlay
        open={!!overlays.marketplace}
        onOpenChange={(open) => setOverlay("marketplace", open)}
        payload={payloads.marketplace}
      />
      <TradeOverlay open={!!overlays.trade} onOpenChange={(open) => setOverlay("trade", open)} payload={payloads.trade} />
      <WalletOverlay open={!!overlays.wallet} onOpenChange={(open) => setOverlay("wallet", open)} />
      <ProfileOverlay open={!!overlays.profile} onOpenChange={(open) => setOverlay("profile", open)} />
      <ActivityLogOverlay open={!!overlays.activityLog} onOpenChange={(open) => setOverlay("activityLog", open)} />
      <VisitFarmOverlay open={!!overlays.visitFarm} onOpenChange={(open) => setOverlay("visitFarm", open)} />
      <LeaderboardOverlay open={!!overlays.leaderboard} onOpenChange={(open) => setOverlay("leaderboard", open)} />
      <FarmUpgradeOverlay
        open={!!overlays.farmUpgrade}
        onOpenChange={(open) => setOverlay("farmUpgrade", open)}
        garden={garden}
      />
      <QuestBoardOverlay open={!!overlays.questBoard} onOpenChange={(open) => setOverlay("questBoard", open)} />
      <OnlinePlayersOverlay
        open={!!overlays.onlinePlayers}
        onOpenChange={(open) => setOverlay("onlinePlayers", open)}
        players={onlinePlayers}
        room={currentRoom}
      />
      <PlayerInteractionOverlay
        open={!!overlays.playerInteraction}
        onOpenChange={(open) => setOverlay("playerInteraction", open)}
        player={payloads.playerInteraction as OnlinePlayer | undefined}
      />
    </>
  );
}
