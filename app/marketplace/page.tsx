import { AuthGate } from "@/components/layout/AuthGate";
import { MarketplaceDashboard } from "@/components/marketplace/MarketplaceDashboard";

export default function MarketplacePage() {
  return (
    <AuthGate>
      <div className="space-y-5">
        <div>
          <p className="text-sm font-semibold text-muted-foreground">Player fruit listings</p>
          <h1 className="text-3xl font-black text-leaf-950">Marketplace</h1>
        </div>
        <MarketplaceDashboard />
      </div>
    </AuthGate>
  );
}
