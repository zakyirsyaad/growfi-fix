"use client";

import { ResponsivePanel } from "@/components/game/overlays/ResponsivePanel";
import { WalletDashboard } from "@/components/wallet/WalletDashboard";

export function WalletOverlay({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <ResponsivePanel
      open={open}
      onOpenChange={onOpenChange}
      title="Wallet"
      description="Inspect real devnet SOL and $GROW balances."
      wide
    >
      <div className="pixel-scope">
        <WalletDashboard compact={true} />
      </div>
    </ResponsivePanel>
  );
}
