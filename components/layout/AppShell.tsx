"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signIn, signOut, useSession } from "next-auth/react";
import { ReactNode } from "react";
import {
  BarChart3,
  Gamepad2,
  Handshake,
  Leaf,
  LogIn,
  LogOut,
  Package,
  ShoppingBasket,
  Store,
  User,
  Wallet,
} from "lucide-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";

import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils/cn";

const navGroups = [
  {
    label: "Play",
    items: [
      { href: "/", label: "Home", icon: Leaf },
      { href: "/game", label: "2D Game", icon: Gamepad2 }
    ]
  },
  {
    label: "Economy",
    items: [
      { href: "/shop", label: "Seed Shop", icon: ShoppingBasket },
      { href: "/marketplace", label: "Marketplace", icon: Store },
      { href: "/inventory", label: "Inventory", icon: Package },
      { href: "/trade", label: "Trade", icon: Handshake },
      { href: "/wallet", label: "Wallet", icon: Wallet }
    ]
  },
  {
    label: "Social",
    items: [
      { href: "/leaderboard", label: "Leaderboard", icon: BarChart3 },
      { href: "/profile", label: "Profile", icon: User }
    ]
  }
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { status } = useSession();
  const isHome = pathname === "/";
  const isGame = pathname === "/game";
  const pageTitle =
    navGroups
      .flatMap((group) => group.items)
      .find((item) => item.href === pathname)?.label || "GrowFi";

  if (isGame) {
    return (
      <div className="min-h-screen text-leaf-950">
        <main className="h-screen w-full overflow-hidden">{children}</main>
      </div>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar variant="inset" collapsible="icon">
        <SidebarHeader>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild size="lg" tooltip="GrowFi">
                <Link href="/">
                  <span className="grid size-8 place-items-center rounded-md bg-leaf-700 text-white">
                    <Leaf className="size-4" />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-base font-black">GrowFi</span>
                    <span className="block truncate text-xs font-bold text-sidebar-foreground/70">
                      $GROW garden economy
                    </span>
                  </span>
                </Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarHeader>

        <SidebarContent>
          {navGroups.map((group) => (
            <SidebarGroup key={group.label}>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const active = pathname === item.href;
                    const Icon = item.icon;

                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton asChild isActive={active} tooltip={item.label}>
                          <Link href={item.href}>
                            <Icon />
                            <span>{item.label}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter>
          {status === "authenticated" ? (
            <>
              <div className="px-2 group-data-[collapsible=icon]:hidden">
                <WalletMultiButton />
              </div>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton onClick={() => signOut()} tooltip="Sign out">
                    <LogOut />
                    <span>Sign out</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </>
          ) : (
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => signIn("discord")} tooltip="Discord login">
                  <LogIn />
                  <span>Discord login</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          )}
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className="min-h-svh text-leaf-950">
        <header className="sticky top-0 z-20 flex h-14 shrink-0 items-center gap-3 border-b border-white/70 bg-white/70 px-4 backdrop-blur md:px-5">
          <SidebarTrigger className="-ml-1 size-8" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-black">{pageTitle}</div>
          </div>
          {status === "authenticated" ? (
            <div className="hidden md:block">
              <WalletMultiButton />
            </div>
          ) : (
            <Button size="sm" onClick={() => signIn("discord")}>
              Login
            </Button>
          )}
        </header>

        <div className={cn("flex-1 px-4 py-5 md:px-8 md:py-8", isHome && "px-0 py-0 md:px-0 md:py-0")}>
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
