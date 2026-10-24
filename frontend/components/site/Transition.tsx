"use client";

import { createContext, useCallback, useContext, useEffect, useRef, type ComponentProps } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import gsap from "gsap";
import { prefersReducedMotion } from "./Motion";

const NavigateCtx = createContext<(href: string) => void>(() => {});

const sha256 = async (s: string) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s))))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

/** Route curtain: the next page is "hashlocked" (its path's real sha256 is shown) while the curtain covers, then released. */
export function TransitionProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const curtain = useRef<HTMLDivElement>(null);
  const bar = useRef<HTMLDivElement>(null);
  const hash = useRef<HTMLSpanElement>(null);
  const route = useRef<HTMLSpanElement>(null);
  const pending = useRef(false);

  const navigate = useCallback(
    (href: string) => {
      if (href === pathname || pending.current) return;
      if (prefersReducedMotion()) return router.push(href);
      pending.current = true;
      route.current!.textContent = href;
      hash.current!.textContent = "0x…";
      sha256(href).then((h) => hash.current && (hash.current.textContent = `0x${h.slice(0, 24)}…`));
      gsap
        .timeline()
        .set(curtain.current, { yPercent: 100, visibility: "visible" })
        .set(bar.current, { scaleX: 0 })
        .to(curtain.current, { yPercent: 0, duration: 0.6, ease: "expo.inOut" })
        .to(bar.current, { scaleX: 0.7, duration: 0.35, ease: "power2.out" }, "-=0.15")
        .add(() => router.push(href));
    },
    [pathname, router]
  );

  useEffect(() => {
    if (!pending.current) return;
    pending.current = false;
    gsap
      .timeline()
      .to(bar.current, { scaleX: 1, duration: 0.25, ease: "power2.out" })
      .to(curtain.current, { yPercent: -100, duration: 0.7, ease: "expo.inOut" })
      .set(curtain.current, { visibility: "hidden" });
  }, [pathname]);

  return (
    <NavigateCtx.Provider value={navigate}>
      {children}
      <div
        ref={curtain}
        aria-hidden
        className="invisible fixed inset-0 z-[80] flex flex-col justify-end bg-[hsl(var(--background))] p-6 sm:p-10"
      >
        <div className="mb-6 flex items-end justify-between gap-6 font-mono text-xs text-muted-foreground">
          <div>
            <div className="label mb-2 text-secret">hashlock</div>
            <span ref={hash} className="break-all text-foreground" />
          </div>
          <span ref={route} className="shrink-0 text-near" />
        </div>
        <div className="h-px w-full bg-border">
          <div ref={bar} className="h-px origin-left bg-gradient-to-r from-polygon via-secret to-near" />
        </div>
      </div>
    </NavigateCtx.Provider>
  );
}

export function TransitionLink({ href, onClick, ...rest }: ComponentProps<typeof Link> & { href: string }) {
  const navigate = useContext(NavigateCtx);
  return (
    <Link
      href={href}
      onClick={(e) => {
        onClick?.(e);
        if (e.defaultPrevented || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return;
        e.preventDefault();
        navigate(href);
      }}
      {...rest}
    />
  );
}
