import type React from "react";
import { cn } from "@/lib/utils";

type StatProps = React.HTMLAttributes<HTMLDivElement> & {
  label: string;
  value: string | number;
};

export function Stat({ label, value, className, ...props }: StatProps) {
  return (
    <div className={cn("rounded-lg bg-white/70 p-3 ring-1 ring-white/80", className)} {...props}>
      <div className="text-xs font-bold uppercase text-leaf-700">{label}</div>
      <div className="mt-1 text-xl font-black text-leaf-950">{value}</div>
    </div>
  );
}
