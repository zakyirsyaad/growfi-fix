import { AuthGate } from "@/components/layout/AuthGate";
import { WalletDashboard } from "@/components/wallet/WalletDashboard";

export default function WalletPage() {
  return (
    <AuthGate>
      <div className="space-y-5">
        <div>
          <p className="text-sm font-semibold text-muted-foreground">$GROW bridge</p>
          <h1 className="text-3xl font-black text-leaf-950">Wallet</h1>
        </div>
        <WalletDashboard />
      </div>
    </AuthGate>
  );
}
