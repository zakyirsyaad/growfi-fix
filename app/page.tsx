"use client";

import Link from "next/link";
import { signIn, useSession } from "next-auth/react";
import {
  ArrowRight,
  Coins,
  Gamepad2,
  ShieldCheck,
  Sprout,
  Store,
  Wallet,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export default function HomePage() {
  const { status } = useSession();

  return (
    <div>
      <section className="relative min-h-[calc(100svh-3.5rem)] overflow-hidden bg-leaf-700">
        <div className="absolute inset-0 opacity-95 [background-image:linear-gradient(90deg,rgba(255,255,255,.08)_1px,transparent_1px),linear-gradient(0deg,rgba(255,255,255,.08)_1px,transparent_1px)] [background-size:48px_48px]" />
        <div className="absolute inset-x-0 bottom-0 grid h-1/2 grid-cols-8 gap-2 p-4 opacity-85">
          {Array.from({ length: 48 }, (_, index) => {
            const planted = index % 4 !== 0;
            const ready = index % 9 === 0;
            const icons = ["🥕", "🍅", "🍓", "🫐", "🍉", "🥭"];
            return (
              <div
                key={index}
                className={`grid min-h-12 place-items-center rounded-md border border-white/20 text-2xl ${
                  ready
                    ? "bg-gold-300/90"
                    : planted
                      ? "bg-leaf-300/90"
                      : "bg-soil-300/90"
                }`}
              >
                {planted ? icons[index % icons.length] : ""}
              </div>
            );
          })}
        </div>
        <div className="relative z-10 flex min-h-[calc(100svh-3.5rem)] items-center px-6 py-16 md:px-16">
          <div className="max-w-2xl space-y-6 text-white">
            <Badge variant="secondary" className="bg-white/90 text-leaf-900">
              Solana farming RPG economy
            </Badge>
            <div>
              <h1 className="text-5xl font-black leading-none md:text-7xl">
                GrowFi
              </h1>
              <p className="mt-5 max-w-xl text-lg font-medium text-white/90">
                A Stardew Valley-inspired browser farming GameFi where you walk
                through a top-down farm and town, plant crops, harvest
                mutations, trade fruit, and move $GROW through a hybrid
                Solana-backed economy.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              {status === "authenticated" ? (
                <Button asChild size="lg">
                  <Link href="/game" target="_blank">
                    Enter 2D Game <ArrowRight className="h-5 w-5" />
                  </Link>
                </Button>
              ) : (
                <Button size="lg" onClick={() => signIn("discord")}>
                  Login with Discord
                </Button>
              )}
              <Button asChild variant="secondary" size="lg">
                <Link href="/leaderboard">Leaderboard</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-6xl gap-4 px-4 py-8 sm:grid-cols-2 lg:grid-cols-4">
        {[
          {
            icon: Gamepad2,
            title: "Playable 2D World",
            body: "Keyboard and mobile controls move your farmer around farm and town maps.",
          },
          {
            icon: Sprout,
            title: "Server-Validated Farming",
            body: "Planting, watering, growth timers, harvest, regrow, stamina, rarity, and mutations validate backend-side.",
          },
          {
            icon: Store,
            title: "Shop and Market",
            body: "Global rotating seed stock, player listings, direct trade, and read-only farm visits stay in the Web UI layer.",
          },
          {
            icon: Wallet,
            title: "$GROW Token Path",
            body: "Discord login, wallet connect, deposit, withdraw, and hybrid in-game balances remain Solana-ready.",
          },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title}>
              <CardContent className="space-y-3 p-5">
                <span className="grid h-11 w-11 place-items-center rounded-md bg-secondary text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <div className="font-bold">{item.title}</div>
                <p className="text-sm text-muted-foreground">{item.body}</p>
              </CardContent>
            </Card>
          );
        })}
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-10">
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-md bg-gold-100 text-gold-700">
                <Coins className="h-6 w-6" />
              </span>
              <div>
                <div className="font-bold">Hybrid economy first</div>
                <p className="text-sm text-muted-foreground">
                  Phaser emits intents; React/API routes validate balance,
                  inventory, timers, and trades.
                </p>
              </div>
            </div>
            <Badge variant="outline" className="gap-1 bg-white">
              <ShieldCheck className="h-4 w-4" />
              No real-time MMO movement in MVP
            </Badge>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}
