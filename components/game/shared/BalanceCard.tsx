import { Coins } from "lucide-react";

export function BalanceCard({
  balance,
  locked,
  label = "Wallet $GROW",
}: {
  balance: number;
  locked?: number;
  label?: string;
}) {
  return (
    <div className="pixel-hud flex items-center gap-3 p-3">
      <span className="pixel-tile grid h-9 w-9 place-items-center text-[#f7d767]">
        <Coins className="h-5 w-5" />
      </span>
      <span>
        <span className="pixel-label block">{label}</span>
        <span className="pixel-value block text-base leading-none">
          {balance}
        </span>
        {locked ? (
          <span className="text-xs text-[#5e8c52]">{locked} locked</span>
        ) : null}
      </span>
    </div>
  );
}
