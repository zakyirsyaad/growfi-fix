import Link from "next/link";
import { Leaf } from "lucide-react";

export function Footer() {
  return (
    <footer className="bg-muted border-t border-border">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center py-12 px-6 lg:px-8 gap-8">
        <div className="flex flex-col items-center md:items-start space-y-4">
          <div className="flex items-center space-x-2">
            <div className="w-6 h-6 rounded bg-primary flex items-center justify-center text-primary-foreground">
              <Leaf className="w-3.5 h-3.5" />
            </div>
            <div className="text-lg font-black text-foreground">GrowFi</div>
          </div>
          <p className="text-muted-foreground text-sm text-center md:text-left max-w-sm">
            Cultivating the future of GameFi on Solana.
            <br />© 2026 GrowFi Ecosystem. All rights reserved.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-x-8 gap-y-4 text-sm font-bold">
          <Link
            href="/marketplace"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Marketplace
          </Link>
        </div>
      </div>
    </footer>
  );
}
