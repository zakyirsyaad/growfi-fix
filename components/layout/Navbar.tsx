"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useSession, signIn, signOut } from "next-auth/react";
import { useState } from "react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { Leaf, Menu, LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

const ROUTES = [
  { href: "/game", label: "Game" },
  { href: "/shop", label: "Shop" },
  { href: "/marketplace", label: "Marketplace" },
  { href: "/inventory", label: "Inventory" },
  { href: "/trade", label: "Trade" },
  { href: "/wallet", label: "Wallet" },
  { href: "/leaderboard", label: "Leaderboard" },
];

export function Navbar() {
  const { data: session, status } = useSession();
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
      <div className="flex justify-between items-center h-16 px-4 md:px-8 max-w-[1400px] mx-auto">
        <Link href="/" className="flex items-center space-x-2 group shrink-0">
          <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
            <Leaf className="w-5 h-5" />
          </div>
          <span className="text-xl font-black text-foreground group-hover:text-primary transition-colors hidden sm:block">
            GrowFi
          </span>
        </Link>

        {/* Desktop Navigation */}
        <div className="hidden lg:flex items-center space-x-6 flex-1 justify-center">
          {ROUTES.map((route) => (
            <Link
              key={route.href}
              href={route.href}
              className={cn(
                "text-sm font-semibold transition-colors hover:text-primary",
                pathname === route.href || pathname.startsWith(route.href + "/")
                  ? "text-primary"
                  : "text-muted-foreground",
              )}
            >
              {route.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center space-x-3 shrink-0">
          {status === "authenticated" && session?.user ? (
            <div className="flex items-center gap-3">
              <Link
                href="/profile"
                className="hidden sm:flex items-center gap-2 pr-2 hover:opacity-80 transition-opacity"
              >
                {session.user.image ? (
                  <Image
                    src={session.user.image}
                    alt="Avatar"
                    width={32}
                    height={32}
                    className="rounded-full border border-border"
                  />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center text-secondary-foreground font-bold text-xs">
                    {session.user.name?.[0] || "U"}
                  </div>
                )}
                <span className="text-sm font-bold text-foreground whitespace-nowrap">
                  {session.user.name}
                </span>
              </Link>
              <div className="hidden md:block">
                <WalletMultiButton className="!bg-primary hover:!bg-primary/90 !text-primary-foreground !rounded-md !font-bold !h-10 !px-4 !transition-colors shadow-sm" />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => signOut()}
                className="hidden sm:flex text-muted-foreground"
                title="Sign Out"
              >
                <LogOut className="w-5 h-5" />
              </Button>
            </div>
          ) : (
            <div className="hidden sm:flex h-10 items-center">
              <Button
                onClick={() => signIn("discord")}
                className="font-bold px-6"
              >
                Login
              </Button>
            </div>
          )}

          {/* Mobile Menu Toggle */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu className="w-6 h-6" />
          </Button>
        </div>
      </div>

      {/* Mobile Navigation */}
      <Sheet open={isMobileMenuOpen} onOpenChange={setIsMobileMenuOpen}>
        <SheetContent side="left" className="w-[300px] sm:w-[400px]">
          <SheetHeader className="mb-6">
            <SheetTitle className="text-left flex items-center space-x-2">
              <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center text-primary-foreground">
                <Leaf className="w-5 h-5" />
              </div>
              <span className="text-xl font-black text-foreground">GrowFi</span>
            </SheetTitle>
          </SheetHeader>
          <div className="flex flex-col space-y-4">
            {ROUTES.map((route) => (
              <Link
                key={route.href}
                href={route.href}
                className={cn(
                  "text-lg font-semibold py-2 px-4 rounded-md transition-colors",
                  pathname === route.href ||
                    pathname.startsWith(route.href + "/")
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-muted",
                )}
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {route.label}
              </Link>
            ))}
            <Link
              href="/profile"
              className={cn(
                "text-lg font-semibold py-2 px-4 rounded-md transition-colors",
                pathname === "/profile"
                  ? "bg-primary/10 text-primary"
                  : "text-foreground hover:bg-muted",
              )}
              onClick={() => setIsMobileMenuOpen(false)}
            >
              Profile
            </Link>

            <div className="pt-4 border-t border-border flex flex-col gap-4">
              {status === "authenticated" ? (
                <>
                  <div className="w-full flex justify-center">
                    <WalletMultiButton className="!w-full !justify-center !bg-primary hover:!bg-primary/90 !text-primary-foreground !rounded-md !font-bold !h-12 !transition-colors shadow-sm" />
                  </div>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      signOut();
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full text-lg font-bold py-6 gap-2"
                  >
                    <LogOut className="w-5 h-5" /> Sign Out
                  </Button>
                </>
              ) : (
                <Button
                  onClick={() => {
                    signIn("discord");
                    setIsMobileMenuOpen(false);
                  }}
                  className="w-full text-lg font-bold py-6"
                >
                  Login with Discord
                </Button>
              )}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </nav>
  );
}
