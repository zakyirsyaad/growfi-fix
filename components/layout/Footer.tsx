"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Leaf } from "lucide-react";
import { cn } from "@/lib/utils";

export function Footer() {
  const pixel = usePathname() === "/";

  return (
    <footer
      className={cn(
        pixel
          ? "bg-[#0a0f0d] border-t-2 border-[#3d9f4b]"
          : "bg-muted border-t border-border",
      )}
    >
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center py-12 px-6 lg:px-8 gap-8">
        <div className="flex flex-col items-center md:items-start space-y-4">
          <div className="flex items-center space-x-2">
            <div
              className={cn(
                "w-6 h-6 flex items-center justify-center text-primary-foreground",
                pixel
                  ? "bg-[#3d9f4b] text-[#0a0f0d] pixel-shadow"
                  : "rounded bg-primary",
              )}
            >
              <Leaf className="w-3.5 h-3.5" />
            </div>
            <div
              className={cn(
                pixel
                  ? "font-pixel text-xs text-[#91d985]"
                  : "text-lg font-black text-foreground",
              )}
            >
              GrowFi
            </div>
          </div>
          <p
            className={cn(
              "text-sm text-center md:text-left max-w-sm",
              pixel ? "text-[#5e8c52] leading-relaxed" : "text-muted-foreground",
            )}
          >
            Cultivating the future of GameFi on Solana.
            <br />© 2026 GrowFi Ecosystem. All rights reserved.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 text-sm font-bold">
          <Link
            href="/marketplace"
            className={cn(
              "transition-colors",
              pixel
                ? "font-pixel text-[10px] text-[#5e8c52] hover:text-[#f7d767]"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Marketplace
          </Link>
        </div>
      </div>
    </footer>
  );
}
