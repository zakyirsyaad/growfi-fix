import { Badge } from "@/components/ui/badge";
import type { Mutation } from "@/types/game-data";

const variants: Record<Mutation, "secondary" | "uncommon" | "epic" | "legendary" | "crystal" | "rainbow"> = {
  NORMAL: "secondary",
  BIG: "uncommon",
  SWEET: "epic",
  GOLDEN: "legendary",
  CRYSTAL: "crystal",
  RAINBOW: "rainbow"
};

export function MutationBadge({ mutation }: { mutation: Mutation }) {
  return <Badge variant={variants[mutation]}>{mutation.toLowerCase()}</Badge>;
}
