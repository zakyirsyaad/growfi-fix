import type React from "react";
import { RarityBadge } from "@/components/game/shared/RarityBadge";
import { MutationBadge } from "@/components/game/shared/MutationBadge";
import type { Mutation, Rarity } from "@/types/game-data";

export function ItemCard({
  icon,
  name,
  quantity,
  rarity,
  mutation,
  children,
}: {
  icon: string;
  name: string;
  quantity?: number;
  rarity?: Rarity;
  mutation?: Mutation;
  children?: React.ReactNode;
}) {
  return (
    <div className="pixel-card space-y-3 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="pixel-tile grid h-12 w-12 shrink-0 place-items-center text-2xl">
            {icon}
          </span>
          <div>
            <div className="font-sans font-bold text-[#f2fbf1]">{name}</div>
            <div className="mt-1 flex flex-wrap gap-1">
              {rarity ? <RarityBadge rarity={rarity} /> : null}
              {mutation ? <MutationBadge mutation={mutation} /> : null}
            </div>
          </div>
        </div>
        {typeof quantity === "number" ? (
          <div className="pixel-value text-base">x{quantity}</div>
        ) : null}
      </div>
      {children}
    </div>
  );
}
