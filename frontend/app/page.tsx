import { Story } from "@/components/home/Story";
import { Marquee } from "@/components/home/Marquee";
import { Facts } from "@/components/home/Facts";
import { Kinetic } from "@/components/site/Motion";
import { TransitionLink } from "@/components/site/Transition";

// Deadlines per evm-near-fusion+/near/src/lib.rs and backend calculateTimelocks()
const OUTCOMES = [
  {
    tag: "Secret revealed in time",
    title: "Both sides claim.",
    body: "The maker claims NEAR before the +30 min withdrawal deadline, and the same secret lets the resolver claim WETH on Polygon.",
    tone: "text-near",
  },
  {
    tag: "Secret never revealed",
    title: "Everything refunds.",
    body: "Nothing can be claimed without the secret. After the +1.5 h cancellation time, the resolver refunds the expired HTLC.",
    tone: "text-polygon",
  },
];

const NEXT = [
  {
    href: "/how-it-works",
    n: "01",
    title: "How it works",
    body: "Both swap directions as a step-by-step sequence across the two chains, drawn as you scroll.",
    tone: "group-hover:text-polygon",
  },
  {
    href: "/contracts",
    n: "02",
    title: "Contracts",
    body: "Every escrow, resolver and HTLC account with explorer links, plus a live hashlock lab.",
    tone: "group-hover:text-secret",
  },
  {
    href: "/swap",
    n: "03",
    title: "Swap",
    body: "Connect MetaMask on Polygon and lock WETH for NEAR through the Fusion+ resolver.",
    tone: "group-hover:text-near",
  },
];

export default function Home() {
  return (
    <>
      <Story />

      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32">
        <p className="label reveal mb-6">
          <span className="text-secret">After the reveal</span> · settled
        </p>
        <Kinetic as="h2" text="Atomic, or nothing." className="mb-6 text-[clamp(2.6rem,7vw,6rem)] font-semibold leading-[0.92] tracking-[-0.04em]" />
        <p className="reveal mb-14 max-w-2xl text-lg leading-relaxed text-muted-foreground">
          Both claims land, or the timelocks expire and the funds go back. No bridge custody, no counterparty risk.
        </p>
        <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-2">
          {OUTCOMES.map((o, i) => (
            <div key={o.title} className="reveal bg-background p-7 sm:p-10" style={{ transitionDelay: `${i * 80}ms` }}>
              <p className={`label mb-8 ${o.tone}`}>{o.tag}</p>
              <h3 className="mb-3 text-2xl font-semibold tracking-tight sm:text-3xl">{o.title}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{o.body}</p>
            </div>
          ))}
        </div>
      </section>

      <Marquee />

      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32">
        <p className="label reveal mb-6">By the numbers</p>
        <Kinetic as="h2" text="Small numbers.|That's the point." className="mb-14 text-[clamp(2.4rem,6vw,5rem)] font-semibold leading-[0.95] tracking-[-0.035em]" />
        <Facts />
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-28 sm:px-6">
        <p className="label reveal mb-6">Go deeper</p>
        <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
          {NEXT.map((c, i) => (
            <div key={c.href} className="reveal bg-background" style={{ transitionDelay: `${i * 80}ms` }}>
            <TransitionLink
              href={c.href}
              className="group flex h-full min-h-[260px] flex-col justify-between p-7 transition-colors hover:bg-card"
            >
              <span className="label">{c.n}</span>
              <div>
                <h3 className={`mb-3 text-3xl font-semibold tracking-tight transition-colors ${c.tone}`}>
                  {c.title} <span className="inline-block transition-transform group-hover:translate-x-1.5">→</span>
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground">{c.body}</p>
              </div>
            </TransitionLink>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
