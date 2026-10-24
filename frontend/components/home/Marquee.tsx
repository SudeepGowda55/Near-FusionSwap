"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { prefersReducedMotion } from "@/components/site/Motion";

const ITEMS = ["sha256 hashlock", "timelock refunds", "Polygon · chain 137", "NEAR testnet", "1inch Fusion+", "escrow factory", "resolver", "no bridge custody"];

/** Ticker that speeds up and skews with scroll velocity (measured from scrollY per frame). */
export function Marquee() {
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const el = track.current!;
    let x = 0, lastY = scrollY, vel = 0;
    const tick = () => {
      const dy = scrollY - lastY;
      lastY = scrollY;
      vel += (dy - vel) * 0.12;
      x -= 0.6 + Math.abs(vel) * 0.35;
      const half = el.scrollWidth / 2;
      if (-x >= half) x += half;
      el.style.transform = `translate3d(${x}px,0,0) skewX(${Math.max(-12, Math.min(12, -vel * 0.4))}deg)`;
    };
    gsap.ticker.add(tick);
    return () => gsap.ticker.remove(tick);
  }, []);

  const row = ITEMS.map((t) => (
    <span key={t} className="flex items-center gap-8 pr-8">
      <span className="whitespace-nowrap">{t}</span>
      <span className="h-2.5 w-2.5 rotate-45 bg-secret" aria-hidden />
    </span>
  ));

  return (
    <div className="overflow-hidden border-y border-border py-6" aria-label={ITEMS.join(", ")}>
      <div ref={track} className="flex w-max text-[clamp(1.6rem,4vw,3.2rem)] font-semibold tracking-tight will-change-transform" aria-hidden>
        {row}
        {row}
      </div>
    </div>
  );
}
