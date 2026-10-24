"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CONTRACTS } from "@/lib/site";

gsap.registerPlugin(ScrollTrigger);

const FACTS = [
  { from: 0, to: 2, label: "chains, Polygon and NEAR", tone: "text-foreground" },
  { from: 0, to: 1, label: "secret unlocks both sides", tone: "text-secret" },
  { from: 0, to: CONTRACTS.length, label: "contracts & accounts you can inspect", tone: "text-near" },
  { from: 9, to: 0, label: "custodians holding your funds", tone: "text-polygon" },
];

/** Numbers and bars scrubbed by scroll position, not played once. */
export function Facts() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      root.current!.querySelectorAll<HTMLElement>("[data-fact]").forEach((el, i) => {
        const n = el.querySelector<HTMLElement>("[data-n]")!;
        const bar = el.querySelector<HTMLElement>("[data-bar]")!;
        const f = FACTS[i];
        const o = { v: f.from };
        gsap
          .timeline({ scrollTrigger: { trigger: el, start: "top 90%", end: "top 45%", scrub: 0.6 } })
          .to(o, { v: f.to, ease: "none", onUpdate: () => (n.textContent = String(Math.round(o.v))) }, 0)
          .fromTo(bar, { scaleX: 0 }, { scaleX: 1, ease: "none" }, 0);
      });
    }, root);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={root} className="grid grid-cols-2 border-l border-t border-border lg:grid-cols-4">
      {FACTS.map((f) => (
        <div key={f.label} data-fact className="border-b border-r border-border p-5 sm:p-8">
          <div data-n className={`mb-3 font-mono text-[clamp(3rem,8vw,6rem)] font-medium leading-none ${f.tone}`}>
            {f.to}
          </div>
          <div className="mb-4 h-px w-full bg-border">
            <div data-bar className="h-px origin-left bg-current text-secret" />
          </div>
          <p className="text-sm text-muted-foreground">{f.label}</p>
        </div>
      ))}
    </div>
  );
}
