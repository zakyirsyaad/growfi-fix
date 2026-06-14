"use client";

import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isGame = pathname === "/game";

  if (isGame) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <main className="h-screen w-full overflow-hidden">{children}</main>
      </div>
    );
  }

  // Home page has its own full-width structure
  if (pathname === "/") {
    return (
      <div className="min-h-screen flex flex-col bg-[#0a0f0d] text-[#ddf5d9] selection:bg-[#3d9f4b]/40">
        <Navbar />
        {children}
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary/30">
      <Navbar />
      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16">
        {children}
      </main>
      <Footer />
    </div>
  );
}
