"use client";

import { Fragment, useEffect, useRef, type ElementType } from "react";
import { usePathname } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

export const prefersReducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

declare global {
  interface Window {
    __lenis?: Lenis;
  }
}

/** Lenis on gsap.ticker + one IntersectionObserver for every `.reveal` on the current route. */
export function SmoothScroll() {
  const pathname = usePathname();

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const lenis = new Lenis({ lerp: 0.11 });
    window.__lenis = lenis;
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (t: number) => lenis.raf(t * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);
    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
      window.__lenis = undefined;
    };
  }, []);

  useEffect(() => {
    window.__lenis?.scrollTo(0, { immediate: true });
    ScrollTrigger.refresh();
    const io = new IntersectionObserver(
      (entries) =>
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("is-in");
            io.unobserve(e.target);
          }
        }),
      { rootMargin: "0px 0px -8% 0px" }
    );
    document.querySelectorAll(".reveal:not(.is-in)").forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);

  return null;
}

/** Split-word headline that rises out of line masks when it enters the viewport. "|" forces a line break. */
export function Kinetic({
  text,
  as: Tag = "h1",
  className,
  delay = 0,
}: {
  text: string;
  as?: ElementType;
  className?: string;
  delay?: number;
}) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const words = el.querySelectorAll(".word-mask > span");
    if (prefersReducedMotion()) {
      gsap.set(words, { yPercent: 0 });
      return;
    }
    const tween = gsap.fromTo(
      words,
      { yPercent: 115, y: 0 },
      { yPercent: 0, duration: 1.1, ease: "expo.out", stagger: 0.055, delay, scrollTrigger: { trigger: el, start: "top 92%" } }
    );
    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [delay]);

  const lines = text.split("|");
  return (
    <Tag ref={ref} className={className} aria-label={text.replace(/\|/g, " ")}>
      {lines.map((line, li) => (
        <Fragment key={li}>
          {line
            .trim()
            .split(" ")
            .map((w, wi, arr) => (
              <Fragment key={wi}>
                <span className="word-mask" aria-hidden>
                  <span className="kinetic-word">{w}</span>
                </span>
                {wi < arr.length - 1 ? " " : null}
              </Fragment>
            ))}
          {li < lines.length - 1 ? <br /> : null}
        </Fragment>
      ))}
    </Tag>
  );
}

/** Desktop pointer life: a follower ring, magnetic `[data-magnetic]` elements and press ripples on `.btn`. */
export function Cursor() {
  const dot = useRef<HTMLDivElement>(null);
  const ring = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches || prefersReducedMotion()) return;
    const d = dot.current!;
    const r = ring.current!;
    const pos = { x: innerWidth / 2, y: innerHeight / 2 };
    const ringPos = { ...pos };
    let scale = 1;
    let magnet: HTMLElement | null = null;
    let hover = false;
    const move = (e: PointerEvent) => {
      d.style.opacity = r.style.opacity = "1";
      pos.x = e.clientX;
      pos.y = e.clientY;
      const t = e.target as Element;
      hover = !!t.closest?.("a, button, [role=button], input, select, [data-magnetic]");
      const m = t.closest?.("[data-magnetic]") as HTMLElement | null;
      if (magnet && magnet !== m) gsap.to(magnet, { x: 0, y: 0, duration: 0.6, ease: "elastic.out(1, 0.4)" });
      magnet = m;
      if (m) {
        const b = m.getBoundingClientRect();
        gsap.to(m, { x: (e.clientX - b.left - b.width / 2) * 0.3, y: (e.clientY - b.top - b.height / 2) * 0.35, duration: 0.4, ease: "power3.out" });
      }
    };
    const down = (e: PointerEvent) => {
      const btn = (e.target as Element).closest?.(".btn") as HTMLElement | null;
      if (!btn) return;
      const b = btn.getBoundingClientRect();
      const size = Math.max(b.width, b.height) * 2;
      const s = document.createElement("span");
      s.className = "ripple";
      s.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - b.left - size / 2}px;top:${e.clientY - b.top - size / 2}px`;
      btn.appendChild(s);
      setTimeout(() => s.remove(), 650);
    };
    const tick = () => {
      ringPos.x += (pos.x - ringPos.x) * 0.18;
      ringPos.y += (pos.y - ringPos.y) * 0.18;
      scale += ((hover ? 1.8 : 1) - scale) * 0.2;
      d.style.transform = `translate3d(${pos.x}px,${pos.y}px,0)`;
      r.style.transform = `translate3d(${ringPos.x}px,${ringPos.y}px,0) scale(${scale})`;
    };
    addEventListener("pointermove", move);
    addEventListener("pointerdown", down);
    gsap.ticker.add(tick);
    return () => {
      removeEventListener("pointermove", move);
      removeEventListener("pointerdown", down);
      gsap.ticker.remove(tick);
    };
  }, []);

  return (
    <>
      <div ref={ring} aria-hidden className="cursor-ring pointer-events-none fixed left-0 top-0 z-[90] -ml-4 -mt-4 h-8 w-8 rounded-full border border-secret/70 opacity-0" />
      <div ref={dot} aria-hidden className="cursor-dot pointer-events-none fixed left-0 top-0 z-[90] -ml-[3px] -mt-[3px] h-1.5 w-1.5 rounded-full bg-secret opacity-0" />
    </>
  );
}
