import { Badge } from "@/components/ui/badge";
import type { Rarity } from "@/types/game-data";

const variants: Record<Rarity, "common" | "uncommon" | "rare" | "epic" | "legendary" | "mythic"> = {
  COMMON: "common",
  UNCOMMON: "uncommon",
  RARE: "rare",
  EPIC: "epic",
  LEGENDARY: "legendary",
  MYTHIC: "mythic"
};

export function RarityBadge({ rarity }: { rarity: Rarity }) {
  return <Badge variant={variants[rarity]}>{rarity.toLowerCase()}</Badge>;
}
