import { GameClient } from "@/components/game/GameClient";
import { WalletGate } from "@/components/game/WalletGate";

export default function GamePage() {
  return (
    <WalletGate>
      <GameClient />
    </WalletGate>
  );
}
