import { AuthGate } from "@/components/layout/AuthGate";
import { GameClient } from "@/components/game/GameClient";

export default function GamePage() {
  return (
    <AuthGate>
      <GameClient />
    </AuthGate>
  );
}
