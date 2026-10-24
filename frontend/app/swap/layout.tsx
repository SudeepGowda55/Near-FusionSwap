import { pageMeta } from "@/lib/site";

export const metadata = pageMeta("/swap", "Swap", "Lock WETH on Polygon and receive NEAR through a hash time-locked Fusion+ swap.");

export default function SwapLayout({ children }: { children: React.ReactNode }) {
  return children;
}
