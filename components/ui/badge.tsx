import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-md border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-primary text-primary-foreground shadow hover:bg-primary/80",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground shadow hover:bg-destructive/80",
        outline: "text-foreground",
        common: "border-leaf-300 bg-leaf-100 text-leaf-700",
        uncommon: "border-skyday-300 bg-skyday-100 text-skyday-700",
        rare: "border-berry-300 bg-berry-100 text-berry-700",
        epic: "border-primary/25 bg-primary/10 text-primary",
        legendary: "border-gold-300 bg-gold-100 text-gold-700",
        mythic: "border-soil-300 bg-soil-100 text-soil-700",
        crystal: "border-skyday-300 bg-white text-skyday-700",
        rainbow:
          "border-transparent bg-gradient-to-r from-berry-300 via-gold-300 to-skyday-300 text-leaf-950",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

export interface BadgeProps
  extends
    React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
