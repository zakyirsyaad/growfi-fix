import type { Rarity } from "@/types/game-data";

const colors: Record<Rarity, string> = {
  COMMON: "#91d985",
  UNCOMMON: "#8ad4ff",
  RARE: "#ff9ebd",
  EPIC: "#c79bff",
  LEGENDARY: "#f7d767",
  MYTHIC: "#ff7b54",
};

export function RarityBadge({ rarity }: { rarity: Rarity }) {
  return (
    <span className="pixel-badge" style={{ color: colors[rarity] }}>
      {rarity}
    </span>
  );
}
