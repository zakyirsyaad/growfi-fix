"use client";

import type React from "react";
import { memo, useRef, useState } from "react";
import { Backpack, Hand, Handshake, Map, ShoppingBasket, Sprout, Store, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { gameEventBus, type GameOverlayKey } from "@/lib/game/eventBus";
import { cn } from "@/lib/utils";

function QuickButton({
  icon: Icon,
  label,
  overlay
}: {
  icon: React.ElementType;
  label: string;
  overlay: GameOverlayKey;
}) {
  return (
    <Button
      variant="secondary"
      size="sm"
      className="h-12 flex-col gap-0 rounded-lg bg-white/90 px-2 text-[11px] shadow-sm"
      onClick={() => gameEventBus.emit("openOverlay", { overlay })}
    >
      <Icon className="h-4 w-4" />
      {label}
    </Button>
  );
}

export const MobileControls = memo(function MobileControls() {
  const padRef = useRef<HTMLDivElement | null>(null);
  const [thumb, setThumb] = useState({ x: 0, y: 0, active: false });

  const updateVector = (clientX: number, clientY: number) => {
    const rect = padRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const dx = clientX - centerX;
    const dy = clientY - centerY;
    const distance = Math.min(38, Math.hypot(dx, dy));
    const angle = Math.atan2(dy, dx);
    const x = Math.cos(angle) * distance;
    const y = Math.sin(angle) * distance;
    setThumb({ x, y, active: true });
    gameEventBus.emit("joystickMove", { x: x / 38, y: y / 38 });
  };

  const end = () => {
    setThumb({ x: 0, y: 0, active: false });
    gameEventBus.emit("joystickEnd");
  };

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 md:hidden">
      <div className="mx-auto grid max-w-lg grid-cols-6 gap-2 px-3 pb-3">
        <QuickButton icon={Backpack} label="Bag" overlay="inventory" />
        <QuickButton icon={ShoppingBasket} label="Shop" overlay="seedShop" />
        <QuickButton icon={Store} label="Market" overlay="marketplace" />
        <QuickButton icon={Wallet} label="Wallet" overlay="wallet" />
        <QuickButton icon={Handshake} label="Trade" overlay="trade" />
        <QuickButton icon={Sprout} label="Farm" overlay="farmUpgrade" />
      </div>

      <div className="pointer-events-none absolute bottom-24 left-5">
        <div
          ref={padRef}
          className="pointer-events-auto relative h-28 w-28 rounded-full border border-white/60 bg-white/35 shadow-sm backdrop-blur"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            updateVector(event.clientX, event.clientY);
          }}
          onPointerMove={(event) => {
            if (thumb.active) {
              updateVector(event.clientX, event.clientY);
            }
          }}
          onPointerUp={end}
          onPointerCancel={end}
        >
          <span
            className={cn(
              "absolute left-1/2 top-1/2 grid h-12 w-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-primary text-primary-foreground shadow",
              thumb.active && "bg-primary/90"
            )}
            style={{ transform: `translate(calc(-50% + ${thumb.x}px), calc(-50% + ${thumb.y}px))` }}
          >
            <Map className="h-5 w-5" />
          </span>
        </div>
      </div>

      <Button
        className="pointer-events-auto absolute bottom-28 right-6 h-20 w-20 rounded-full text-base shadow-lg"
        onClick={() => gameEventBus.emit("interact")}
      >
        <Hand className="h-6 w-6" />
      </Button>
    </div>
  );
});
