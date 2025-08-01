"use client";

import { Header } from "@/components/Header";
import { SwapInterface } from "@/components/SwapInterface";
import { useAccount } from "wagmi";

export default function Home() {
  const { isConnected } = useAccount();

  return (
    <div className="min-h-screen bg-background">
      <Header isWalletConnected={isConnected} onWalletConnect={() => {}} />
      <main className="flex items-center justify-center py-8">
        <SwapInterface isWalletConnected={isConnected} onConnectWallet={() => {}} />
      </main>
    </div>
  );
}
