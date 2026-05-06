import { Coins } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

export function BalanceCard({ balance, locked }: { balance: number; locked?: number }) {
  return (
    <Card className="bg-white/88">
      <CardContent className="flex items-center gap-3 p-3">
        <span className="grid h-9 w-9 place-items-center rounded-md bg-gold-100 text-gold-700">
          <Coins className="h-5 w-5" />
        </span>
        <span>
          <span className="block text-xs font-semibold text-muted-foreground">$GROW</span>
          <span className="block text-lg font-bold leading-none">{balance}</span>
          {locked ? <span className="text-xs text-muted-foreground">{locked} locked</span> : null}
        </span>
      </CardContent>
    </Card>
  );
}
