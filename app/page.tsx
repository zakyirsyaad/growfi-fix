import Link from "next/link";

const STATS = [
  { label: "TOTAL VOLUME", value: "$12.4M", icon: "📊", color: "#f7d767" },
  { label: "FARMERS", value: "8,420", icon: "🧑‍🌾", color: "#91d985" },
  { label: "ITEMS TRADED", value: "1.2M+", icon: "📦", color: "#8ad4ff" },
  { label: "NETWORK", value: "SOLANA", icon: "⚡", color: "#ff9ebd" },
];

const STEPS = [
  { n: "01", icon: "🪙", title: "CONNECT", body: "Link your Solana wallet to enter the farm." },
  { n: "02", icon: "🌱", title: "PLANT", body: "Sow seeds and tend your plots to grow crops." },
  { n: "03", icon: "💰", title: "EARN", body: "Harvest rare mutations and trade for $GROW." },
];

const FEATURES = [
  {
    icon: "🌾",
    title: "FARM & HARVEST",
    body: "Plant seeds, tend your land, and harvest rare genetic mutations on a cozy 2D tile world. Every crop you grow is yours.",
    color: "#91d985",
    tag: "GAMEPLAY",
  },
  {
    icon: "🔁",
    title: "PLAYER TRADING",
    body: "Swap rare crops on the global market with zero slippage. Direct peer-to-peer deals, no middlemen, no hidden fees.",
    color: "#8ad4ff",
    tag: "MARKET",
  },
  {
    icon: "🪙",
    title: "ON-CHAIN $GROW",
    body: "True ownership of every asset. Transparent reward distribution on an open Solana economy you can verify.",
    color: "#f7d767",
    tag: "ECONOMY",
  },
];

export default function HomePage() {
  return (
    <main className="font-pixel text-[#ddf5d9] overflow-hidden">
      {/* HERO — asymmetric: copy left, pixel farm scene right */}
      <section className="relative pixel-sky scanlines pt-32 pb-32 px-6">
        <div className="pointer-events-none absolute inset-0">
          <span className="absolute left-[12%] top-[18%] h-1.5 w-1.5 bg-[#f7d767] animate-pixel-twinkle" />
          <span className="absolute left-[82%] top-[14%] h-1.5 w-1.5 bg-[#8ad4ff] animate-pixel-twinkle [animation-delay:0.6s]" />
          <span className="absolute left-[64%] top-[30%] h-1.5 w-1.5 bg-[#ff9ebd] animate-pixel-twinkle [animation-delay:1.1s]" />
          <span className="absolute left-[30%] top-[8%] h-1.5 w-1.5 bg-[#91d985] animate-pixel-twinkle [animation-delay:1.6s]" />
          {/* pixel sun */}
          <div className="pixel-sun absolute right-[8%] top-[10%] h-10 w-10 animate-pixel-twinkle" />
        </div>

        <div className="relative z-20 mx-auto grid max-w-6xl items-center gap-12 md:grid-cols-2">
          {/* Left: copy */}
          <div className="text-center md:text-left">
            <div className="mb-8 inline-flex items-center gap-3 border-2 border-[#3d9f4b] bg-[#0d2614] px-4 py-3 pixel-shadow">
              <span className="h-2 w-2 bg-[#91d985] animate-pixel-blink" />
              <span className="text-[10px] text-[#91d985]">A NEW ERA OF GAMEFI</span>
            </div>
            <h1 className="text-2xl leading-relaxed md:text-4xl md:leading-relaxed text-[#f2fbf1]">
              CULTIVATE YOUR
              <br />
              <span className="text-[#f7d767]">DIGITAL HARVEST</span>
            </h1>
            <p className="mx-auto mt-8 max-w-md font-sans text-base leading-relaxed text-[#91d985] md:mx-0 md:text-lg">
              A Stardew-inspired 2D farming GameFi on Solana. Plant seeds, grow
              rare mutations, and trade assets in a player-owned pixel economy.
            </p>
            <div className="mt-10 flex flex-col items-center gap-5 sm:flex-row md:items-start">
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

          {/* Right: pixel farm scene — framed plot grid with growing crops */}
          <div className="relative mx-auto w-full max-w-sm">
            <div className="border-2 border-[#0a0f0d] bg-[#287235] p-3 pixel-shadow-lg">
              {/* clouds */}
              <div className="mb-3 flex justify-between text-lg">
                <span className="animate-pixel-float select-none">☁️</span>
                <span className="animate-pixel-float select-none [animation-delay:1s]">☁️</span>
              </div>
              {/* 4x3 dirt plot grid */}
              <div className="grid grid-cols-4 gap-1.5">
                {["🌱","🌾","🌽","🌱","🍓","🌻","🌱","🥕","🌾","🌱","🍅","🌷"].map((crop, i) => (
                  <div
                    key={i}
                    className="pixel-dirt flex aspect-square items-center justify-center text-lg"
                  >
                    <span
                      className="animate-pixel-float select-none"
                      style={{ animationDelay: `${(i % 4) * 0.3}s` }}
                    >
                      {crop}
                    </span>
                  </div>
                ))}
              </div>
              <div className="mt-3 border-2 border-[#0a0f0d] bg-[#0d2614] px-3 py-2 text-center text-[8px] text-[#91d985]">
                YOUR FARM · PLOT #4821
              </div>
            </div>
          </div>
        </div>

        {/* layered pixel ground */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-5 bg-[#3d9f4b]" />
        <div className="pointer-events-none absolute inset-x-0 bottom-5 z-10 h-2.5 bg-[#287235]" />
      </section>

      {/* STATS — overlapping pixel cards, each with its own accent */}
      <section className="relative bg-[#0a0f0d] px-6">
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 border border-[#3d9f4b] bg-[#0a0f0d] px-2 py-1 text-[8px] text-[#5e8c52]">
          DEMO DATA
        </div>
        <div className="mx-auto -mt-10 grid max-w-5xl grid-cols-2 gap-4 md:grid-cols-4">
          {STATS.map((stat) => (
            <div
              key={stat.label}
              className="border-2 border-[#0a0f0d] bg-[#0d2614] p-5 text-center pixel-shadow"
              style={{ borderColor: stat.color }}
            >
              <div className="mb-2 text-2xl">{stat.icon}</div>
              <div className="text-lg md:text-xl" style={{ color: stat.color }}>
                {stat.value}
              </div>
              <div className="mt-2 text-[8px] text-[#5e8c52]">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS — horizontal step path */}
      <section className="bg-[#0a0f0d] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-16 text-center text-xl text-[#f2fbf1] md:text-2xl">
            HOW IT <span className="text-[#8ad4ff]">WORKS</span>
          </h2>
          <div className="relative grid gap-12 md:grid-cols-3">
            {/* connecting pixel path (desktop) */}
            <div className="pixel-path pointer-events-none absolute left-[16%] right-[16%] top-7 hidden h-1 md:block" />
            {STEPS.map((step) => (
              <div key={step.n} className="relative z-10 text-center">
                <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center border-2 border-[#0a0f0d] bg-[#8ad4ff] text-2xl pixel-shadow">
                  {step.icon}
                </div>
                <div className="mb-2 text-[10px] text-[#5e8c52]">STEP {step.n}</div>
                <h3 className="mb-3 text-sm text-[#f7d767]">{step.title}</h3>
                <p className="mx-auto max-w-[14rem] font-sans text-sm leading-relaxed text-[#91d985]">
                  {step.body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURES — zig-zag, big sprite alternating sides */}
      <section className="border-y-2 border-[#3d9f4b] bg-[#0d2614] px-6 py-24">
        <div className="mx-auto max-w-5xl">
          <h2 className="mb-16 text-center text-xl text-[#f2fbf1] md:text-2xl">
            ECOSYSTEM <span className="text-[#91d985]">ESSENTIALS</span>
          </h2>
          <div className="space-y-10">
            {FEATURES.map((feature, i) => (
              <div
                key={feature.title}
                className={`flex flex-col items-center gap-8 border-2 border-[#3d9f4b] bg-[#0a0f0d] p-8 pixel-shadow md:gap-12 md:p-10 ${
                  i % 2 === 1 ? "md:flex-row-reverse" : "md:flex-row"
                }`}
              >
                {/* big sprite tile */}
                <div
                  className="flex h-28 w-28 flex-shrink-0 items-center justify-center border-2 border-[#0a0f0d] text-5xl pixel-shadow"
                  style={{ backgroundColor: `${feature.color}22` }}
                >
                  <span className="animate-pixel-float select-none">{feature.icon}</span>
                </div>
                {/* copy */}
                <div className="flex-1 text-center md:text-left">
                  <div
                    className="mb-3 inline-block border px-2 py-1 text-[8px]"
                    style={{ color: feature.color, borderColor: feature.color }}
                  >
                    {feature.tag}
                  </div>
                  <h3 className="mb-4 text-base md:text-lg" style={{ color: feature.color }}>
                    {feature.title}
                  </h3>
                  <p className="font-sans text-sm leading-relaxed text-[#91d985] md:text-base">
                    {feature.body}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA — full-bleed pixel landscape banner */}
      <section className="relative overflow-hidden bg-[#0a0f0d]">
        <div className="pixel-dawn scanlines relative px-6 py-28">
          {/* sun */}
          <div className="pixel-sun absolute left-1/2 top-12 h-12 w-12 -translate-x-1/2" />
          {/* layered pixel hills */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-[#287235]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-[#3d9f4b]" />
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-5 bg-[#153d21]" />

          <div className="relative z-20 mx-auto max-w-2xl text-center">
            <div className="mb-6 animate-pixel-float text-5xl">🚜</div>
            <h2 className="text-xl leading-relaxed text-[#0a0f0d] md:text-2xl md:leading-relaxed">
              READY TO
              <br />
              BREAK GROUND?
            </h2>
            <p className="mx-auto mt-6 max-w-md font-sans text-base font-semibold text-[#0d2614]">
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
