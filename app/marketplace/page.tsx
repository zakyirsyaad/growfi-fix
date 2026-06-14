import { AuthGate } from "@/components/layout/AuthGate";
import { MarketplaceDashboard } from "@/components/marketplace/MarketplaceDashboard";

export default function MarketplacePage() {
  return (
    <AuthGate>
      <MarketplaceDashboard />
    </AuthGate>
  );
}
