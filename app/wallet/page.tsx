import { AuthGate } from "@/components/layout/AuthGate";
import { WalletDashboard } from "@/components/wallet/WalletDashboard";

export default function WalletPage() {
  return (
    <AuthGate>
      <div className="w-full mt-8">
        <header className="mb-8 border-b border-border pb-4">
          <h1 className="text-4xl font-black text-foreground mb-2">
            Wallet Dashboard
          </h1>
          <p className="text-lg text-muted-foreground font-medium">
            Manage your ecosystem assets and transaction history.
          </p>
        </header>
        <WalletDashboard />
      </div>
    </AuthGate>
  );
}
