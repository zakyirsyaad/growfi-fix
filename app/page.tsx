import Link from "next/link";

const FEATURES = [
  {
    icon: "🌱",
    title: "FARM & HARVEST",
    body: "Plant seeds, tend your land, and harvest rare genetic mutations on a cozy 2D tile world.",
    color: "#91d985",
  },
  {
    icon: "🔁",
    title: "PLAYER TRADING",
    body: "Swap rare crops on the global market with zero slippage. Direct peer-to-peer deals.",
    color: "#8ad4ff",
  },
  {
    icon: "🪙",
    title: "ON-CHAIN $GROW",
    body: "True ownership of every asset. Transparent rewards on an open Solana economy.",
    color: "#f7d767",
  },
];

const STATS = [
  { label: "TOTAL VOLUME", value: "$12.4M" },
  { label: "FARMERS", value: "8,420" },
  { label: "ITEMS TRADED", value: "1.2M+" },
  { label: "NETWORK", value: "SOLANA" },
];

export default function HomePage() {
  return (
    <main className="font-pixel text-[#ddf5d9] overflow-hidden">
      {/* HERO */}
      <section className="relative pixel-sky scanlines pt-36 pb-28 px-6">
        {/* Twinkling pixel stars */}
        <div className="pointer-events-none absolute inset-0">
          <span className="absolute left-[12%] top-[18%] h-1.5 w-1.5 bg-[#f7d767] animate-pixel-twinkle" />
          <span className="absolute left-[78%] top-[12%] h-1.5 w-1.5 bg-[#8ad4ff] animate-pixel-twinkle [animation-delay:0.6s]" />
          <span className="absolute left-[64%] top-[30%] h-1.5 w-1.5 bg-[#ff9ebd] animate-pixel-twinkle [animation-delay:1.1s]" />
          <span className="absolute left-[30%] top-[8%] h-1.5 w-1.5 bg-[#91d985] animate-pixel-twinkle [animation-delay:1.6s]" />
        </div>

        <div className="relative z-20 mx-auto max-w-4xl text-center">
          {/* Pixel badge */}
          <div className="mb-8 inline-flex items-center gap-3 border-2 border-[#3d9f4b] bg-[#0d2614] px-4 py-3 pixel-shadow">
            <span className="h-2 w-2 bg-[#91d985] animate-pixel-blink" />
            <span className="text-[10px] text-[#91d985]">
              A NEW ERA OF GAMEFI
            </span>
          </div>

          {/* Floating crop sprite */}
          <div className="mb-6 flex justify-center">
            <div className="animate-pixel-float select-none text-6xl md:text-7xl drop-shadow-[4px_4px_0_rgba(0,0,0,0.6)]">
              🌾
            </div>
          </div>

          <h1 className="text-2xl leading-relaxed md:text-4xl md:leading-relaxed text-[#f2fbf1]">
            CULTIVATE YOUR
            <br />
            <span className="text-[#f7d767]">DIGITAL HARVEST</span>
          </h1>

          <p className="mx-auto mt-8 max-w-xl font-sans text-base leading-relaxed text-[#91d985] md:text-lg">
            A Stardew-inspired 2D farming GameFi on Solana. Plant seeds, grow
            rare mutations, and trade assets in a player-owned pixel economy.
          </p>

          <div className="mt-10 flex flex-col items-center justify-center gap-5 sm:flex-row">
            <Link
              href="/game"
              className="w-full border-2 border-[#0a0f0d] bg-[#3d9f4b] px-8 py-4 text-xs text-[#0a0f0d] pixel-shadow transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-[#91d985] sm:w-auto"
            >
              ▶ START PLAYING
            </Link>
            <Link
              href="/marketplace"
              className="w-full border-2 border-[#3d9f4b] bg-[#0d2614] px-8 py-4 text-xs text-[#91d985] transition-colors hover:border-[#f7d767] hover:text-[#f7d767] sm:w-auto"
            >
              EXPLORE MARKET
            </Link>
          </div>
        </div>

        {/* Pixel ground strip */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 h-6 bg-[#3d9f4b]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-6 z-20 h-3 bg-[#287235]" />
      </section>

      {/* STATS STRIP */}
      <section className="relative border-y-2 border-[#3d9f4b] bg-[#0d2614]">
        <div className="absolute -top-3 left-6 border border-[#3d9f4b] bg-[#0a0f0d] px-2 py-1 text-[8px] text-[#5e8c52]">
          DEMO DATA
        </div>
        <div className="mx-auto grid max-w-6xl grid-cols-2 gap-px md:grid-cols-4">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="flex flex-col items-center justify-center gap-3 px-4 py-10 text-center"
            >
              <span className="text-[8px] text-[#5e8c52]">{stat.label}</span>
              <span className="text-lg text-[#f7d767] md:text-xl">
                {stat.value}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section className="bg-[#0a0f0d] px-6 py-24">
        <div className="mx-auto max-w-6xl">
          <div className="mb-16 text-center">
            <h2 className="text-xl text-[#f2fbf1] md:text-2xl">
              ECOSYSTEM <span className="text-[#91d985]">ESSENTIALS</span>
            </h2>
            <p className="mx-auto mt-6 max-w-xl font-sans text-base text-[#5e8c52]">
              Everything you need to cultivate your digital empire — built pixel
              by pixel.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="group border-2 border-[#3d9f4b] bg-[#0d2614] p-8 pixel-shadow transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5"
              >
                <div className="mb-6 flex h-14 w-14 items-center justify-center border-2 border-[#0a0f0d] bg-[#0a0f0d] text-2xl group-hover:animate-pixel-float">
                  {feature.icon}
                </div>
                <h3
                  className="mb-4 text-sm"
                  style={{ color: feature.color }}
                >
                  {feature.title}
                </h3>
                <p className="font-sans text-sm leading-relaxed text-[#91d985]">
                  {feature.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-[#0a0f0d] px-6 pb-28">
        <div className="relative mx-auto max-w-4xl scanlines border-2 border-[#3d9f4b] bg-[#0d2614] p-12 text-center pixel-shadow-lg md:p-20">
          <div className="relative z-20">
            <div className="mb-8 animate-pixel-float text-5xl">🚜</div>
            <h2 className="text-xl leading-relaxed text-[#f2fbf1] md:text-2xl md:leading-relaxed">
              READY TO
              <br />
              <span className="text-[#f7d767]">BREAK GROUND?</span>
            </h2>
            <p className="mx-auto mt-8 max-w-md font-sans text-base text-[#91d985]">
              Connect your Solana wallet and join thousands of players in the
              cozy pixel farming sim built on-chain.
            </p>
            <Link
              href="/game"
              className="mt-10 inline-block border-2 border-[#0a0f0d] bg-[#f7d767] px-10 py-4 text-xs text-[#0a0f0d] pixel-shadow transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:bg-[#fff4c7]"
            >
              ▶ PLAY NOW — FREE
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
