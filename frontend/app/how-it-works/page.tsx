import { Kinetic } from "@/components/site/Motion";
import { Sequence, Timelocks } from "@/components/how/Sequence";
import { TransitionLink } from "@/components/site/Transition";
import { pageMeta } from "@/lib/site";

export const metadata = pageMeta(
  "/how-it-works",
  "How it works",
  "Step by step: how a hash time-locked swap settles between Polygon and NEAR, in both directions."
);

const GUARANTEES = [
  { t: "Hash secrets", b: "Both chains lock to the same sha256 hash. Revealing the preimage to claim on one chain publishes it for the other.", c: "text-secret" },
  { t: "Time locks", b: "Every HTLC carries deadlines. If the secret never appears, the locked funds go back instead of getting stuck.", c: "text-near" },
  { t: "No counterparty risk", b: "Neither the maker nor the resolver can take funds without the secret, and nobody else ever custodies them.", c: "text-polygon" },
];

export default function HowItWorks() {
  return (
    <div className="mx-auto max-w-7xl px-4 pb-28 pt-28 sm:px-6 sm:pt-36">
      <p className="label mb-5 text-secret">Hash time-locked contracts · 1inch Fusion+</p>
      <Kinetic
        text="Five steps.|Two chains.|Zero trust."
        className="mb-8 text-[clamp(2.8rem,7vw,6rem)] font-semibold leading-[0.92] tracking-[-0.04em]"
      />
      <p className="reveal mb-20 max-w-2xl text-lg leading-relaxed text-muted-foreground">
        A cross-chain swap is two escrows that can only open with the same secret. Pick a direction and scroll: each step lights
        up on the chain where it happens.
      </p>

      <Sequence />

      <section className="mt-32">
        <p className="label reveal mb-5">Why it can&apos;t half-happen</p>
        <Kinetic as="h2" text="Atomic by construction." className="mb-12 text-[clamp(2.2rem,5vw,4rem)] font-semibold leading-[0.95] tracking-[-0.035em]" />
        <div className="grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
          {GUARANTEES.map((g, i) => (
            <div key={g.t} className="reveal bg-background p-7" style={{ transitionDelay: `${i * 80}ms` }}>
              <p className={`mb-8 font-mono text-sm ${g.c}`}>0{i + 1}</p>
              <h3 className="mb-3 text-2xl font-semibold tracking-tight">{g.t}</h3>
              <p className="text-sm leading-relaxed text-muted-foreground">{g.b}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-32">
        <p className="label reveal mb-5">NEAR HTLC timelocks · from creation</p>
        <Kinetic as="h2" text="The clock is part of the lock." className="mb-12 text-[clamp(2.2rem,5vw,4rem)] font-semibold leading-[0.95] tracking-[-0.035em]" />
        <Timelocks />
      </section>

      <div className="reveal mt-28 flex flex-col items-start justify-between gap-6 rounded-3xl border border-border p-8 sm:flex-row sm:items-center sm:p-12">
        <p className="text-2xl font-semibold tracking-tight sm:text-3xl">See the contracts behind each step.</p>
        <TransitionLink href="/contracts" className="btn-near" data-magnetic>
          Contracts →
        </TransitionLink>
      </div>
    </div>
  );
}
