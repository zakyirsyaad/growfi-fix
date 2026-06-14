import type { Mutation } from "@/types/game-data";

const colors: Record<Mutation, string> = {
  NORMAL: "#5e8c52",
  BIG: "#8ad4ff",
  SWEET: "#c79bff",
  GOLDEN: "#f7d767",
  CRYSTAL: "#ddf5d9",
  RAINBOW: "#ff9ebd",
};

export function MutationBadge({ mutation }: { mutation: Mutation }) {
  return (
    <span className="pixel-badge" style={{ color: colors[mutation] }}>
      {mutation}
    </span>
  );
}
