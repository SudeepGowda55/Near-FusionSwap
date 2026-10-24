export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://near-fusion-swap.vercel.app";
export const SITE_NAME = "Near-FusionSwap";
export const SITE_PITCH = "Trustless WETH → NEAR swaps between Polygon and NEAR, secured by hash time-locked contracts and 1inch Fusion+.";
export const REPO_URL = "https://github.com/SudeepGowda55/Near-FusionSwap";
export const DEMO_URL = "https://youtu.be/mxFI6glcaMY";
export const OG_IMAGE = { url: "/og.png", width: 1200, height: 627 };

export const pageMeta = (path: string, title: string, description: string) => ({
  title,
  description,
  alternates: { canonical: path },
  openGraph: { title: `${title} · ${SITE_NAME}`, description, url: path, images: [OG_IMAGE] },
  twitter: { card: "summary_large_image" as const, title: `${title} · ${SITE_NAME}`, description, images: [OG_IMAGE.url] },
});

export const NAV = [
  { href: "/", label: "Story" },
  { href: "/how-it-works", label: "How it works" },
  { href: "/contracts", label: "Contracts" },
  { href: "/swap", label: "Swap" },
];

// Real deployment data, mirrored from backend/src/constants.ts and backend/src/near.service.ts
export const CONTRACTS = [
  { chain: "Polygon", label: "Escrow factory", value: "0x4925d712590f6e3d1df35B099610385FE435fa8f", href: "https://polygonscan.com/address/0x4925d712590f6e3d1df35B099610385FE435fa8f" },
  { chain: "Polygon", label: "Resolver contract", value: "0x24E370E00e71004867C57455414E770C532Cb1ee", href: "https://polygonscan.com/address/0x24E370E00e71004867C57455414E770C532Cb1ee" },
  { chain: "Polygon", label: "Resolver account", value: "0x77ed0fef5e9DFB34e776adb11c29dd19d382745C", href: "https://polygonscan.com/address/0x77ed0fef5e9dfb34e776adb11c29dd19d382745c" },
  { chain: "NEAR", label: "HTLC contract", value: "flexlock-1inch.testnet", href: "https://testnet.nearblocks.io/address/flexlock-1inch.testnet" },
  { chain: "NEAR", label: "Resolver account", value: "htlc.testnet", href: "https://testnet.nearblocks.io/address/htlc.testnet" },
  { chain: "NEAR", label: "Test maker account", value: "goldrogerswap.testnet", href: "https://testnet.nearblocks.io/address/goldrogerswap.testnet" },
];
