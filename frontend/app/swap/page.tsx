"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { SwapInterface } from "@/components/SwapInterface";
import { ConnectWalletModal } from "@/components/ConnectWalletModal";
import { Kinetic } from "@/components/site/Motion";

const ROUTE = [
  { k: "You", v: "MetaMask · Polygon (137)", tone: "bg-polygon" },
  { k: "Source escrow", v: "factory 0x4925…fa8f", tone: "bg-polygon" },
  { k: "Hashlock", v: "sha256(secret)", tone: "bg-secret" },
  { k: "Destination HTLC", v: "flexlock-1inch.testnet", tone: "bg-near" },
  { k: "Receiver", v: "your NEAR account", tone: "bg-near" },
];

export default function SwapPage() {
  const { isConnected } = useAccount();
  const [walletOpen, setWalletOpen] = useState(false);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-24 pt-28 sm:px-6 sm:pt-36">
      <p className="label mb-5 text-secret">WETH (Polygon) → NEAR · live route</p>
      <Kinetic text="Lock WETH.|Receive NEAR." className="mb-12 text-[clamp(2.8rem,7vw,6rem)] font-semibold leading-[0.92] tracking-[-0.04em]" />

      <div className="grid items-start gap-10 lg:grid-cols-[minmax(0,460px)_1fr] lg:gap-16">
        <div className="reveal [&>div]:max-w-none [&>div]:p-0">
          <SwapInterface isWalletConnected={isConnected} onConnectWallet={() => setWalletOpen(true)} />
        </div>

        <aside className="reveal" aria-label="Swap route">
          <p className="label mb-6">Route your order takes</p>
          <ol className="relative">
            <span className="absolute bottom-3 left-[7px] top-3 w-px bg-border" aria-hidden>
              <span className="route-pulse absolute -left-[3px] h-[7px] w-[7px] rounded-full bg-secret shadow-[0_0_14px_hsl(var(--secret))]" />
            </span>
            {ROUTE.map((r) => (
              <li key={r.k} className="relative flex items-baseline gap-5 py-4 pl-8">
                <span className={`absolute left-0 top-[22px] h-[15px] w-[15px] rounded-full border-4 border-background ${r.tone}`} aria-hidden />
                <span className="w-36 shrink-0 text-sm font-semibold">{r.k}</span>
                <span className="truncate font-mono text-xs text-muted-foreground">{r.v}</span>
              </li>
            ))}
          </ol>
          <div className="mt-8 rounded-2xl border border-border p-5 text-sm leading-relaxed text-muted-foreground">
            <span className="label mb-2 block text-foreground">Before you swap</span>
            Only WETH → NEAR is live; other pairs show as coming soon. Amounts are fixed test sizes (0.000001 or 0.000002 WETH),
            and the backend must be running for the cross-chain step.
          </div>
        </aside>
      </div>

      <ConnectWalletModal isOpen={walletOpen} onClose={() => setWalletOpen(false)} />
    </div>
  );
}
