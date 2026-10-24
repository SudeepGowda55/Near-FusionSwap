/* eslint-disable @next/next/no-img-element -- one external YouTube thumbnail, not worth configuring next/image remotes */
import { Kinetic } from "@/components/site/Motion";
import { ContractTable, HashLab } from "@/components/contracts/Lab";
import { DEMO_URL, pageMeta } from "@/lib/site";

export const metadata = pageMeta(
  "/contracts",
  "Contracts",
  "The Polygon escrows and NEAR HTLC accounts behind Near-FusionSwap, with explorer links and a live hashlock lab."
);

const STACK = [
  { k: "Polygon contracts", v: "Solidity · Foundry · 1inch cross-chain-swap" },
  { k: "NEAR contracts", v: "Rust · near-sdk · cargo-near" },
  { k: "Backend", v: "NestJS · ethers · near-api-js · 1inch cross-chain SDK" },
  { k: "Frontend", v: "Next.js · wagmi · MetaMask · three.js" },
];

export default function Contracts() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-28 pt-28 sm:px-6 sm:pt-36">
      <p className="label mb-5 text-secret">Proof · inspect every lock</p>
      <Kinetic text="Don't trust.|Verify the locks." className="mb-16 text-[clamp(2.8rem,7vw,6rem)] font-semibold leading-[0.92] tracking-[-0.04em]" />

      <ContractTable />

      <section className="mt-28">
        <p className="label reveal mb-5">Hashlock lab</p>
        <Kinetic as="h2" text="One secret, one hash." className="mb-10 text-[clamp(2.2rem,5vw,4rem)] font-semibold leading-[0.95] tracking-[-0.035em]" />
        <HashLab />
      </section>

      <section className="mt-28 grid gap-10 lg:grid-cols-2">
        <a href={DEMO_URL} target="_blank" rel="noreferrer" className="reveal group relative block overflow-hidden rounded-3xl border border-border">
          <img
            src="https://img.youtube.com/vi/mxFI6glcaMY/hqdefault.jpg"
            alt="Near-FusionSwap demo video thumbnail"
            className="aspect-video w-full object-cover opacity-70 transition-[opacity,transform] duration-700 group-hover:scale-[1.03] group-hover:opacity-100"
            loading="lazy"
          />
          <span className="absolute inset-0 grid place-items-center">
            <span className="btn-near pointer-events-none">▶ Watch the demo</span>
          </span>
        </a>
        <div className="reveal">
          <p className="label mb-6">Stack</p>
          <dl className="divide-y divide-border border-y border-border">
            {STACK.map((s) => (
              <div key={s.k} className="grid gap-1 py-4 sm:grid-cols-[170px_1fr]">
                <dt className="text-sm font-semibold">{s.k}</dt>
                <dd className="font-mono text-sm text-muted-foreground">{s.v}</dd>
              </div>
            ))}
          </dl>
        </div>
      </section>
    </div>
  );
}
