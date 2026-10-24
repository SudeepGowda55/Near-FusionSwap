"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { useAccount } from "wagmi";
import { Menu, X } from "lucide-react";
import { ConnectWalletModal } from "@/components/ConnectWalletModal";
import { TransitionLink } from "./Transition";
import { NAV, REPO_URL } from "@/lib/site";
import { cn } from "@/lib/utils";

export const LogoMark = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 32 32" className={className} aria-hidden>
    <circle cx="12" cy="16" r="8" fill="none" stroke="hsl(var(--polygon))" strokeWidth="2.5" />
    <circle cx="20" cy="16" r="8" fill="none" stroke="hsl(var(--near))" strokeWidth="2.5" />
    <circle cx="16" cy="16" r="2.4" fill="hsl(var(--secret))" />
  </svg>
);

export function Nav() {
  const pathname = usePathname();
  const { isConnected, address } = useAccount();
  const [walletOpen, setWalletOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/70 bg-[hsl(var(--background)/0.86)]">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <TransitionLink href="/" className="flex items-center gap-2.5" aria-label="Near-FusionSwap home">
          <LogoMark className="h-8 w-8" />
          <span className="text-[15px] font-semibold tracking-tight">
            Near<span className="text-muted-foreground">·</span>FusionSwap
          </span>
        </TransitionLink>

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
          {NAV.map((l) => (
            <TransitionLink
              key={l.href}
              href={l.href}
              className={cn(
                "relative rounded-full px-4 py-2 text-sm transition-colors",
                pathname === l.href ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
            >
              {l.label}
              {pathname === l.href && <span className="absolute inset-x-4 -bottom-[13px] h-px bg-near" />}
            </TransitionLink>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button data-magnetic onClick={() => setWalletOpen(true)} className="btn-near hidden px-4 py-2 sm:inline-flex">
            {isConnected && address ? `${address.slice(0, 6)}…${address.slice(-4)}` : "Connect wallet"}
          </button>
          <a
            href={REPO_URL}
            target="_blank"
            rel="noreferrer"
            aria-label="GitHub repository"
            data-magnetic
            className="grid h-10 w-10 place-items-center rounded-full border border-border text-muted-foreground transition-colors hover:border-foreground/40 hover:text-foreground"
          >
            <svg viewBox="0 0 16 16" className="h-[18px] w-[18px]" fill="currentColor" aria-hidden>
              <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
            </svg>
          </a>
          <button
            className="grid h-10 w-10 place-items-center rounded-full border border-border md:hidden"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {menuOpen && (
        <nav className="border-t border-border px-4 pb-5 pt-2 md:hidden" aria-label="Mobile">
          {NAV.map((l, i) => (
            <TransitionLink
              key={l.href}
              href={l.href}
              onClick={() => setMenuOpen(false)}
              className="flex items-baseline gap-4 border-b border-border/60 py-4 text-2xl font-semibold"
            >
              <span className="label">0{i + 1}</span>
              {l.label}
            </TransitionLink>
          ))}
          <button onClick={() => setWalletOpen(true)} className="btn-near mt-5 w-full">
            {isConnected ? "Wallet connected" : "Connect wallet"}
          </button>
        </nav>
      )}

      <ConnectWalletModal isOpen={walletOpen} onClose={() => setWalletOpen(false)} />
    </header>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <LogoMark className="h-7 w-7" />
          <span className="font-mono text-xs text-muted-foreground">Polygon ⇄ NEAR · HTLC · 1inch Fusion+</span>
        </div>
        <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          {NAV.map((l) => (
            <TransitionLink key={l.href} href={l.href} className="hover:text-foreground">
              {l.label}
            </TransitionLink>
          ))}
          <a href={REPO_URL} target="_blank" rel="noreferrer" className="hover:text-foreground">
            GitHub ↗
          </a>
        </div>
      </div>
    </footer>
  );
}
