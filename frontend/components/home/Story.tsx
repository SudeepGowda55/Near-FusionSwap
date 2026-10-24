"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Kinetic } from "@/components/site/Motion";
import { TransitionLink } from "@/components/site/Transition";
import { cn } from "@/lib/utils";
import type { HtlcStore } from "./htlcScene";

gsap.registerPlugin(ScrollTrigger);

// start fetching the three.js chunk while React hydrates
const scenePromise = typeof window !== "undefined" ? import("./htlcScene") : null;

const CHAPTERS = [
  {
    tag: "Intent",
    title: "The maker signs one order.",
    body: "A Fusion+ order: WETH on Polygon for NEAR on NEAR. A secret is generated and only its sha256 hash leaves the wallet.",
  },
  {
    tag: "Source lock",
    title: "WETH is locked on Polygon.",
    body: "The escrow factory deploys a source escrow. The WETH inside can only move with the secret, or back to the maker after the timelock.",
  },
  {
    tag: "Destination lock",
    title: "The resolver locks NEAR.",
    body: "htlc.testnet funds a matching HTLC on flexlock-1inch.testnet with is_destination = true, bound to the very same hash.",
  },
  {
    tag: "Reveal",
    title: "One secret opens both.",
    body: "With both sides locked, the secret is revealed. The maker claims NEAR, and the same preimage lets the resolver claim WETH on Polygon.",
  },
];

const LEGEND = [
  { c: "bg-polygon", l: "Polygon escrow" },
  { c: "bg-near", l: "NEAR HTLC" },
  { c: "bg-secret", l: "Secret / hashlock" },
];

export function Story() {
  const wrap = useRef<HTMLElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const rail = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const store = useRef<HtlcStore>({ p: 0, px: 0, py: 0 }).current;
  const [active, setActive] = useState(0);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let dispose: (() => void) | undefined;
    let alive = true;
    scenePromise?.then((m) => {
      if (alive && canvas.current) dispose = m.createHtlcScene(canvas.current, store, () => setReady(true));
    });

    const move = (e: PointerEvent) => {
      store.px = (e.clientX / innerWidth) * 2 - 1;
      store.py = -((e.clientY / innerHeight) * 2 - 1);
    };
    addEventListener("pointermove", move);

    // one scrubbed timeline tweening a plain store; the render loop eases toward it
    const tl = gsap
      .timeline({
        scrollTrigger: { trigger: wrap.current, start: "top top", end: "bottom bottom", scrub: 0.8 },
        onUpdate: () => {
          setActive(Math.round(store.p));
          const f = store.p / 4;
          if (rail.current) rail.current.style.transform = `scaleY(${f})`;
          if (bar.current) bar.current.style.transform = `scaleX(${f})`;
        },
      })
      .to(store, { p: 4, ease: "none", duration: 0.9 })
      .to({}, { duration: 0.1 });

    return () => {
      alive = false;
      dispose?.();
      removeEventListener("pointermove", move);
      tl.scrollTrigger?.kill();
      tl.kill();
    };
  }, [store]);

  return (
    <section ref={wrap} className="relative h-[480vh]" aria-label="How a cross-chain HTLC swap locks and unlocks, told in four chapters">
      <div className="sticky top-0 h-[100svh] overflow-hidden">
        <canvas
          ref={canvas}
          className={cn("absolute inset-0 h-full w-full transition-opacity duration-1000", ready ? "opacity-100" : "opacity-0")}
          role="img"
          aria-label="3D simulation: a violet Polygon vault and a mint NEAR vault joined by a particle bridge, with an amber secret caged by its hash between them"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[55%] bg-gradient-to-t from-background via-background/80 to-transparent" />

        {/* progress, mobile */}
        <div className="absolute inset-x-0 top-16 h-px bg-border md:hidden">
          <div ref={bar} className="h-px origin-left scale-x-0 bg-gradient-to-r from-polygon via-secret to-near" />
        </div>

        <div className="pointer-events-none absolute inset-x-0 top-20 mx-auto flex max-w-7xl items-start justify-between px-4 sm:top-24 sm:px-6">
          <span className="label">Simulation · HTLC lifecycle</span>
          <ul className="hidden flex-col items-end gap-1.5 sm:flex">
            {LEGEND.map((x) => (
              <li key={x.l} className="label flex items-center gap-2">
                {x.l} <span className={cn("h-2 w-2 rounded-full", x.c)} />
              </li>
            ))}
          </ul>
        </div>

        {/* chapter rail, desktop */}
        <div className={cn("absolute right-6 top-1/2 hidden -translate-y-1/2 transition-opacity duration-500 lg:block", active === 0 && "opacity-0")} aria-hidden>
          <div className="absolute -left-4 top-0 h-full w-px bg-border">
            <div ref={rail} className="h-full w-px origin-top scale-y-0 bg-gradient-to-b from-polygon via-secret to-near" />
          </div>
          <ol>
          {CHAPTERS.map((c, i) => (
            <li key={c.tag} className={cn("label py-2.5 transition-colors duration-300", active === i + 1 && "text-foreground")}>
              0{i + 1} {c.tag}
            </li>
          ))}
          </ol>
        </div>

        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-7xl px-4 pb-10 sm:px-6 sm:pb-14">
          {/* hero */}
          <div
            className={cn(
              "grid gap-8 transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)] lg:grid-cols-[1.5fr_1fr] lg:items-end",
              active > 0 && "pointer-events-none translate-y-8 opacity-0"
            )}
          >
            <div>
              <p className="label mb-4 text-secret">Polygon ⇄ NEAR · atomic swaps</p>
              <Kinetic
                text="Two locks.|One secret."
                className="text-[clamp(3.2rem,9vw,8.4rem)] font-semibold leading-[0.9] tracking-[-0.04em]"
                delay={0.15}
              />
            </div>
            <div className="max-w-md">
              <p className="mb-6 text-base leading-relaxed text-muted-foreground sm:text-lg">
                Swap WETH on Polygon for NEAR without a bridge holding your funds. Both chains lock to the same hash, so either
                everything settles or everything refunds.
              </p>
              <div className="flex flex-wrap gap-3">
                <TransitionLink href="/swap" className="btn-near" data-magnetic>
                  Launch swap →
                </TransitionLink>
                <TransitionLink href="/how-it-works" className="btn-ghost" data-magnetic>
                  How it works
                </TransitionLink>
              </div>
              <p className="label mt-8 hidden sm:block">Scroll to run the swap ↓</p>
            </div>
          </div>

          {/* chapters */}
          {CHAPTERS.map((c, i) => {
            const on = active === i + 1;
            return (
              <div
                key={c.tag}
                aria-hidden={!on}
                className={cn(
                  "absolute bottom-10 left-4 right-4 max-w-xl transition-opacity duration-500 sm:bottom-14 sm:left-6",
                  on ? "opacity-100" : "pointer-events-none opacity-0"
                )}
              >
                <p className="label mb-3">
                  <span className="text-secret">0{i + 1}</span> / 04 · {c.tag}
                </p>
                <h2 className="mb-4 text-[clamp(2rem,4.6vw,3.6rem)] font-semibold leading-[0.98] tracking-[-0.03em]">
                  {c.title.split(" ").map((w, wi, arr) => (
                    <span key={wi}>
                      <span className="word-mask">
                        <span
                          className="transition-transform duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]"
                          style={{ transform: on ? "none" : "translateY(110%)", transitionDelay: on ? `${wi * 45}ms` : "0ms" }}
                        >
                          {w}
                        </span>
                      </span>
                      {wi < arr.length - 1 ? " " : null}
                    </span>
                  ))}
                </h2>
                <p className="max-w-lg text-[15px] leading-relaxed text-muted-foreground sm:text-base">{c.body}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
