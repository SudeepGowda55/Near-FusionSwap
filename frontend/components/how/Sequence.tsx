"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { cn } from "@/lib/utils";

gsap.registerPlugin(ScrollTrigger);

type Side = "polygon" | "near" | "cross";
type Step = { side: Side; title: string; body: string };

// From the README's HTLC workflow phases and backend/src/app.controller.ts
const PHASES: { key: string; label: string; status: string; steps: Step[] }[] = [
  {
    key: "p2n",
    label: "Polygon → NEAR",
    status: "Live in the swap UI",
    steps: [
      { side: "polygon", title: "Order + source escrow", body: "The maker's Fusion+ order deploys a source escrow on Polygon holding WETH, locked to sha256(secret)." },
      { side: "near", title: "HTLC created", body: "The resolver htlc.testnet creates a new HTLC on flexlock-1inch.testnet." },
      { side: "near", title: "Funded as destination", body: "The resolver deposits NEAR into the HTLC with is_destination = true." },
      { side: "near", title: "Secret revealed", body: "The maker reveals the secret and claims the NEAR from the HTLC." },
      { side: "cross", title: "Cross-chain claim", body: "The revealed secret is now public on NEAR, so the resolver uses it to claim WETH from the Polygon escrow." },
    ],
  },
  {
    key: "n2p",
    label: "NEAR → Polygon",
    status: "Backend flow · UI coming soon",
    steps: [
      { side: "near", title: "HTLC created", body: "The maker goldrogerswap.testnet creates a new HTLC on NEAR." },
      { side: "near", title: "Funded as source", body: "The maker deposits NEAR into the HTLC with is_destination = false." },
      { side: "polygon", title: "Destination escrow", body: "The resolver locks the Polygon side to the same hash." },
      { side: "near", title: "Secret revealed", body: "The resolver reveals the secret and claims the NEAR from the HTLC." },
      { side: "cross", title: "Cross-chain claim", body: "With the revealed secret, the maker claims ETH/USDC from the Polygon HTLC." },
    ],
  },
];

const TONE: Record<Side, string> = { polygon: "text-polygon", near: "text-near", cross: "text-secret" };
const CHAIN: Record<Side, string> = { polygon: "Polygon", near: "NEAR", cross: "NEAR → Polygon" };

export function Sequence() {
  const [phase, setPhase] = useState(0);
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.fromTo(
        "[data-spine]",
        { scaleY: 0 },
        { scaleY: 1, ease: "none", scrollTrigger: { trigger: root.current, start: "top 70%", end: "bottom 60%", scrub: 0.5 } }
      );
      gsap.utils.toArray<HTMLElement>("[data-step]").forEach((el) => {
        const side = el.dataset.step;
        gsap.fromTo(
          el,
          { opacity: 0.15, x: side === "polygon" ? -40 : side === "near" ? 40 : 0 },
          { opacity: 1, x: 0, ease: "none", scrollTrigger: { trigger: el, start: "top 88%", end: "top 62%", scrub: 0.5 } }
        );
        const line = el.querySelector("[data-line]");
        if (line)
          gsap.fromTo(line, { scaleX: 0 }, { scaleX: 1, ease: "none", scrollTrigger: { trigger: el, start: "top 80%", end: "top 55%", scrub: 0.5 } });
      });
    }, root);
    ScrollTrigger.refresh();
    return () => ctx.revert();
  }, [phase]);

  const p = PHASES[phase];
  return (
    <div>
      <div className="mb-12 flex flex-wrap items-center gap-3" role="tablist" aria-label="Swap direction">
        {PHASES.map((x, i) => (
          <button
            key={x.key}
            role="tab"
            aria-selected={phase === i}
            onClick={() => setPhase(i)}
            className={cn("btn", phase === i ? "bg-foreground text-background" : "border border-border text-muted-foreground hover:text-foreground")}
          >
            Phase {i + 1} · {x.label}
          </button>
        ))}
        <span className="label ml-1">{p.status}</span>
      </div>

      <div className="mb-6 hidden grid-cols-2 gap-16 md:grid">
        <p className="label text-right text-polygon">Polygon · chain 137</p>
        <p className="label text-near">NEAR · testnet</p>
      </div>

      <div ref={root} key={p.key} className="relative">
        <div className="absolute bottom-0 left-1/2 top-0 hidden w-px bg-border md:block" aria-hidden>
          <div data-spine className="h-full w-px origin-top bg-gradient-to-b from-polygon via-secret to-near" />
        </div>
        <ol className="space-y-6 md:space-y-10">
          {p.steps.map((s, i) => (
            <li
              key={i}
              data-step={s.side}
              className={cn(
                "relative md:grid md:grid-cols-2 md:gap-16",
                s.side === "cross" && "md:block"
              )}
            >
              <div
                className={cn(
                  "rounded-2xl border border-border bg-card p-6",
                  s.side === "near" && "md:col-start-2",
                  s.side === "cross" && "md:mx-auto md:max-w-2xl"
                )}
              >
                <div className="mb-3 flex items-center justify-between gap-4">
                  <span className="label">
                    <span className={TONE[s.side]}>0{i + 1}</span> · {CHAIN[s.side]}
                  </span>
                </div>
                <h3 className="mb-2 text-xl font-semibold tracking-tight">{s.title}</h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{s.body}</p>
                {s.side === "cross" && (
                  <div className="mt-5 flex items-center gap-3 font-mono text-[11px] text-muted-foreground">
                    <span className="text-polygon">Polygon</span>
                    <div className="h-px flex-1 bg-border">
                      <div data-line className="h-px origin-right bg-gradient-to-l from-near via-secret to-polygon" />
                    </div>
                    <span className="text-near">NEAR</span>
                  </div>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

// Real windows from backend/src/near.service.ts calculateTimelocks(); enforcement per evm-near-fusion+/near/src/lib.rs
const WINDOWS = [
  { at: 0.5, label: "withdrawal", note: "+30 min · claim deadline: the secret must be revealed before this" },
  { at: 1, label: "public_withdrawal", note: "+1 h · recorded in the HTLC, not yet enforced by the contract" },
  { at: 1.5, label: "cancellation", note: "+1.5 h · after this the resolver can refund the expired HTLC" },
  { at: 2, label: "public_cancellation", note: "+2 h · recorded in the HTLC, not yet enforced by the contract" },
];

export function Timelocks() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ scrollTrigger: { trigger: root.current, start: "top 75%", end: "bottom 55%", scrub: 0.5 } });
      tl.fromTo("[data-fill]", { scaleX: 0 }, { scaleX: 1, ease: "none" }, 0);
      gsap.utils.toArray<HTMLElement>("[data-window]").forEach((el, i) =>
        tl.fromTo(el, { opacity: 0.2, y: 12 }, { opacity: 1, y: 0, duration: 0.15 }, i * 0.25)
      );
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={root}>
      <div className="relative mb-10 h-2 rounded-full bg-secondary">
        <div data-fill className="h-2 origin-left rounded-full bg-gradient-to-r from-near via-secret to-destructive" />
        {WINDOWS.map((w) => (
          <span key={w.label} className="absolute top-1/2 h-4 w-px -translate-y-1/2 bg-foreground/60" style={{ left: `${(w.at / 2) * 100}%` }} />
        ))}
      </div>
      <ol className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border sm:grid-cols-2 lg:grid-cols-4">
        {WINDOWS.map((w) => (
          <li key={w.label} data-window className="bg-background p-5">
            <p className="mb-2 font-mono text-sm text-secret">{w.label}</p>
            <p className="text-sm leading-relaxed text-muted-foreground">{w.note}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
