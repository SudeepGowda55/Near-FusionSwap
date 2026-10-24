"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy } from "lucide-react";
import { CONTRACTS } from "@/lib/site";
import { prefersReducedMotion } from "@/components/site/Motion";

const HEX = "0123456789abcdef";

/** Live hashlock: type a secret, watch its real sha256 decode into place. */
export function HashLab() {
  const [secret, setSecret] = useState("goldrogerswap-secret");
  const out = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    let raf = 0;
    let cancelled = false;
    crypto.subtle.digest("SHA-256", new TextEncoder().encode(secret)).then((buf) => {
      if (cancelled || !out.current) return;
      const hash = Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
      if (prefersReducedMotion()) return void (out.current.textContent = hash);
      const start = performance.now();
      const step = (now: number) => {
        const settled = Math.floor((now - start) / 9);
        out.current!.textContent = Array.from(hash, (c, i) => (i < settled ? c : HEX[(Math.random() * 16) | 0])).join("");
        if (settled < hash.length) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    });
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [secret]);

  return (
    <div className="rounded-3xl border border-border bg-card p-6 sm:p-10">
      <label htmlFor="secret" className="label mb-3 block">
        Secret (preimage) · stays with the maker until claim
      </label>
      <input
        id="secret"
        value={secret}
        onChange={(e) => setSecret(e.target.value)}
        spellCheck={false}
        className="mb-8 w-full rounded-xl border border-border bg-background px-4 py-3 font-mono text-base text-secret outline-none transition-colors focus:border-secret"
      />
      <p className="label mb-3">sha256(secret) · the hashlock both HTLCs store</p>
      <p className="break-all font-mono text-lg leading-relaxed text-foreground sm:text-2xl" aria-live="polite">
        0x<span ref={out} />
      </p>
      <p className="mt-8 max-w-xl text-sm leading-relaxed text-muted-foreground">
        Change one character and the whole hash changes. That is why the escrows can publish the hash openly: nobody can work
        backwards to the secret, yet anyone can check a revealed secret against it. Computed in your browser with Web Crypto.
      </p>
    </div>
  );
}

export function ContractTable() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (v: string) => {
    navigator.clipboard?.writeText(v).then(() => {
      setCopied(v);
      setTimeout(() => setCopied((c) => (c === v ? null : c)), 1400);
    });
  };

  return (
    <ul className="divide-y divide-border overflow-hidden rounded-2xl border border-border">
      {CONTRACTS.map((c, i) => (
        <li key={c.value} className="reveal grid gap-2 bg-background p-5 sm:grid-cols-[150px_180px_1fr_auto] sm:items-center sm:gap-6" style={{ transitionDelay: `${i * 50}ms` }}>
          <span className="label flex items-center gap-2">
            <span className={`h-2 w-2 rounded-full ${c.chain === "NEAR" ? "bg-near" : "bg-polygon"}`} />
            {c.chain}
          </span>
          <span className="text-sm font-semibold">{c.label}</span>
          <span className="truncate font-mono text-sm text-muted-foreground">{c.value}</span>
          <span className="flex gap-2">
            <button
              onClick={() => copy(c.value)}
              aria-label={`Copy ${c.label} address`}
              className="grid h-9 w-9 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:text-foreground"
            >
              {copied === c.value ? <Check className="h-4 w-4 text-near" /> : <Copy className="h-4 w-4" />}
            </button>
            <a
              href={c.href}
              target="_blank"
              rel="noreferrer"
              className="flex h-9 items-center rounded-full border border-border px-4 text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Explorer ↗
            </a>
          </span>
        </li>
      ))}
    </ul>
  );
}
