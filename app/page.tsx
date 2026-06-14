import Link from "next/link";
import {
  Sprout,
  ArrowRightLeft,
  Coins,
  Leaf,
  Sparkles,
  MoveRight,
} from "lucide-react";

export default function HomePage() {
  return (
    <main className="min-h-screen bg-background text-foreground overflow-hidden selection:bg-primary/20">
      {/* HERO */}
      <section className="relative pt-32 pb-20 md:pt-40 md:pb-32 px-6 flex flex-col items-center justify-center text-center">
        {/* Soft ambient glows — warmed to match the red/gold harvest palette */}
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[800px] h-[500px] opacity-30 bg-primary/20 rounded-full blur-[120px] pointer-events-none"></div>
        <div className="absolute top-[20%] right-[-10%] w-[400px] h-[400px] opacity-20 bg-gold-300/30 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="relative z-10 max-w-4xl mx-auto space-y-8 flex flex-col items-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-muted/60 border border-border/60 text-sm font-medium backdrop-blur-sm text-muted-foreground">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>Welcome to the new era of GameFi</span>
          </div>

          <h1 className="text-5xl md:text-7xl lg:text-[5.5rem] font-bold tracking-tight leading-[1.1] text-foreground">
            Cultivate your <br className="hidden md:block" />
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary via-gold-500 to-primary animate-gradient-x">
              digital harvest.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto font-medium leading-relaxed">
            A minimalist 2D farming experience on Solana. Plant seeds, grow rare
            mutations, and trade assets in a seamless, player-owned economy.
          </p>

          <div className="pt-6 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
            <Link
              href="/game"
              className="w-full sm:w-auto px-8 py-4 bg-primary text-primary-foreground font-semibold text-lg rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 flex items-center justify-center gap-2 group"
            >
              Start Playing
              <MoveRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/marketplace"
              className="w-full sm:w-auto px-8 py-4 bg-background text-foreground font-semibold text-lg rounded-xl border border-border hover:bg-muted/60 hover:-translate-y-0.5 transition-all flex items-center justify-center"
            >
              Explore Market
            </Link>
          </div>
        </div>
      </section>

      {/* STATS STRIP */}
      <section className="relative z-20 border-y border-border/50 bg-background/60 backdrop-blur-xl">
        <div className="absolute -top-3 left-6 bg-muted border border-border px-3 py-0.5 rounded-md text-[10px] font-bold text-muted-foreground uppercase tracking-wider shadow-sm z-30">
          Demo Data
        </div>
        <div className="max-w-7xl mx-auto px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-0 divide-x divide-border/50">
          <div className="flex flex-col items-center justify-center space-y-2 px-4">
            <span className="text-sm font-medium text-muted-foreground">
              Total Volume
            </span>
            <span className="text-3xl md:text-4xl font-semibold tracking-tight">
              $12.4M
            </span>
          </div>
          <div className="flex flex-col items-center justify-center space-y-2 px-4">
            <span className="text-sm font-medium text-muted-foreground">
              Active Farmers
            </span>
            <span className="text-3xl md:text-4xl font-semibold tracking-tight">
              8,420
            </span>
          </div>
          <div className="flex flex-col items-center justify-center space-y-2 px-4">
            <span className="text-sm font-medium text-muted-foreground">
              Items Traded
            </span>
            <span className="text-3xl md:text-4xl font-semibold tracking-tight">
              1.2M+
            </span>
          </div>
          <div className="flex flex-col items-center justify-center space-y-2 px-4">
            <span className="text-sm font-medium text-muted-foreground">
              Network
            </span>
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_10px_oklch(var(--primary)/0.6)]"></div>
              <span className="text-3xl md:text-4xl font-semibold tracking-tight">
                Solana
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="py-24 md:py-32 px-6 max-w-7xl mx-auto">
        <div className="text-center mb-16 space-y-4">
          <h2 className="text-3xl md:text-5xl font-bold tracking-tight">
            Ecosystem Essentials
          </h2>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
            Everything you need to cultivate your digital empire, built with
            speed and elegance in mind.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {/* Card 1 */}
          <div className="group relative bg-card/60 backdrop-blur-sm border border-border/60 p-8 rounded-2xl flex flex-col hover:bg-card hover:border-border hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-[3rem] -z-10 group-hover:bg-primary/10 transition-colors duration-300"></div>
            <div className="w-12 h-12 bg-background border border-border/60 rounded-xl flex items-center justify-center mb-8 shadow-sm group-hover:scale-110 transition-transform duration-300">
              <Sprout className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-2xl font-semibold mb-3">Farm &amp; Harvest</h3>
            <p className="text-muted-foreground leading-relaxed">
              Plant seeds, manage your land, and wait for crops to grow.
              Experience serene mechanics with a chance to harvest rare genetic
              mutations.
            </p>
          </div>

          {/* Card 2 */}
          <div className="group relative bg-card/60 backdrop-blur-sm border border-border/60 p-8 rounded-2xl flex flex-col hover:bg-card hover:border-border hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-[3rem] -z-10 group-hover:bg-primary/10 transition-colors duration-300"></div>
            <div className="w-12 h-12 bg-background border border-border/60 rounded-xl flex items-center justify-center mb-8 shadow-sm group-hover:scale-110 transition-transform duration-300">
              <ArrowRightLeft className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-2xl font-semibold mb-3">Seamless Trading</h3>
            <p className="text-muted-foreground leading-relaxed">
              Access the global marketplace to buy and sell rare crops. Enjoy
              direct player-to-player trading with zero slippage.
            </p>
          </div>

          {/* Card 3 */}
          <div className="group relative bg-card/60 backdrop-blur-sm border border-border/60 p-8 rounded-2xl flex flex-col hover:bg-card hover:border-border hover:shadow-xl hover:shadow-primary/5 hover:-translate-y-1 transition-all duration-300 overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-[3rem] -z-10 group-hover:bg-primary/10 transition-colors duration-300"></div>
            <div className="w-12 h-12 bg-background border border-border/60 rounded-xl flex items-center justify-center mb-8 shadow-sm group-hover:scale-110 transition-transform duration-300">
              <Coins className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-2xl font-semibold mb-3">On-chain Economy</h3>
            <p className="text-muted-foreground leading-relaxed">
              Powered by the $GROW token. True ownership of your assets,
              transparent reward distributions, and a completely open market.
            </p>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 md:py-32 px-6">
        <div className="max-w-5xl mx-auto bg-gradient-to-b from-card to-background border border-border/60 rounded-3xl p-12 md:p-20 text-center relative overflow-hidden shadow-2xl">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-primary/10 rounded-full blur-[80px]"></div>
          <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-gold-300/10 rounded-full blur-[80px]"></div>

          <div className="relative z-10 max-w-2xl mx-auto space-y-8 flex flex-col items-center">
            <Leaf className="w-12 h-12 text-primary" />
            <h2 className="text-4xl md:text-5xl font-bold tracking-tight">
              Ready to break ground?
            </h2>
            <p className="text-lg text-muted-foreground leading-relaxed">
              Connect your Solana wallet and join thousands of players in the
              most elegant web3 farming simulator built today.
            </p>
            <Link
              href="/game"
              className="px-10 py-4 bg-foreground text-background font-semibold text-lg rounded-xl hover:bg-foreground/90 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
            >
              Play Now for Free
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
