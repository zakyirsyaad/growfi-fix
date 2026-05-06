"use client";

import { ResponsivePanel } from "@/components/game/overlays/ResponsivePanel";
import { WalletDashboard } from "@/components/wallet/WalletDashboard";

export function WalletOverlay({
  open,
  onOpenChange
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <ResponsivePanel open={open} onOpenChange={onOpenChange} title="Wallet" description="Deposit, withdraw, and inspect $GROW transactions." wide>
      <WalletDashboard compact />
    </ResponsivePanel>
  );
}
