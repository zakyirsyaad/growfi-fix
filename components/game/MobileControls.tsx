"use client";

import type React from "react";
import { memo, useEffect, useRef } from "react";
import {
  Backpack,
  Hand,
  Handshake,
  HelpCircle,
  Map,
  ShoppingBasket,
  Sprout,
  Store,
  Wallet,
} from "lucide-react";
import { gameEventBus, type GameOverlayKey } from "@/lib/game/eventBus";
import { cn } from "@/lib/utils";

function QuickButton({
  icon: Icon,
  label,
  overlay,
}: {
  icon: React.ElementType;
  label: string;
  overlay: GameOverlayKey;
}) {
  return (
    <button
      type="button"
      className="pixel-hud flex h-12 flex-col items-center justify-center gap-0.5 px-2 text-[9px] text-[#91d985] active:translate-y-0.5"
      onClick={() => gameEventBus.emit("openOverlay", { overlay })}
    >
      <Icon className="h-4 w-4" />
      <span className="font-pixel leading-none">{label}</span>
    </button>
  );
}

export const MobileControls = memo(function MobileControls() {
  const padRef = useRef<HTMLDivElement | null>(null);
  const thumbRef = useRef<HTMLSpanElement | null>(null);
  const activeRef = useRef(false);
  const frameRef = useRef<number | null>(null);

  const moveThumb = (x: number, y: number, active: boolean) => {
    const thumb = thumbRef.current;
    if (!thumb) {
      return;
    }

    if (frameRef.current !== null) {
      cancelAnimationFrame(frameRef.current);
    }

    frameRef.current = requestAnimationFrame(() => {
      thumb.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
      thumb.dataset.active = active ? "true" : "false";
      frameRef.current = null;
    });
  };

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
    activeRef.current = true;
    moveThumb(x, y, true);
    gameEventBus.emit("joystickMove", { x: x / 38, y: y / 38 });
  };

  const end = () => {
    activeRef.current = false;
    moveThumb(0, 0, false);
    gameEventBus.emit("joystickEnd");
  };

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) {
        cancelAnimationFrame(frameRef.current);
      }
      gameEventBus.emit("joystickEnd");
    };
  }, []);

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 md:hidden">
      <div className="mx-auto grid max-w-xl grid-cols-7 gap-2 px-3 pb-3">
        <QuickButton icon={Backpack} label="Bag" overlay="inventory" />
        <QuickButton icon={ShoppingBasket} label="Shop" overlay="seedShop" />
        <QuickButton icon={Store} label="Market" overlay="marketplace" />
        <QuickButton icon={Wallet} label="Wallet" overlay="wallet" />
        <QuickButton icon={Handshake} label="Trade" overlay="trade" />
        <QuickButton icon={Sprout} label="Farm" overlay="farmUpgrade" />
        <QuickButton icon={HelpCircle} label="Help" overlay="tutorial" />
      </div>

      <div className="pointer-events-none absolute bottom-24 left-5">
        <div
          ref={padRef}
          className="pointer-events-auto relative h-28 w-28 touch-none rounded-full border-2 border-[#3d9f4b] bg-[#0d2614]/70 backdrop-blur"
          onPointerDown={(event) => {
            event.currentTarget.setPointerCapture(event.pointerId);
            updateVector(event.clientX, event.clientY);
          }}
          onPointerMove={(event) => {
            if (activeRef.current) {
              updateVector(event.clientX, event.clientY);
            }
          }}
          onPointerUp={end}
          onPointerCancel={end}
        >
          <span
            ref={thumbRef}
            data-active="false"
            className={cn(
              "absolute left-1/2 top-1/2 grid h-12 w-12 place-items-center border-2 border-[#0a0f0d] bg-[#3d9f4b] text-[#0a0f0d] transition-colors data-[active=true]:bg-[#91d985]",
            )}
            style={{ transform: "translate(-50%, -50%)" }}
          >
            <Map className="h-5 w-5" />
          </span>
        </div>
      </div>

      <button
        type="button"
        className="pixel-btn pixel-btn-primary pointer-events-auto absolute bottom-28 right-6 h-20 w-20 rounded-none"
        onClick={() => gameEventBus.emit("interact")}
      >
        <Hand className="h-6 w-6" />
      </button>
    </div>
  );
});
