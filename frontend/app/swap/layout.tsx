import { pageMeta } from "@/lib/site";

export const metadata = pageMeta("/swap", "Swap", "Lock WETH on Polygon and receive NEAR through a hash time-locked 1inch Fusion+ swap: both chains lock to the same hash, so it settles or refunds.");

export default function SwapLayout({ children }: { children: React.ReactNode }) {
  return children;
}
