"use client";

import { Header } from "@/components/Header";
import { SwapInterface } from "@/components/SwapInterface";
import { useState } from "react";

export default function Home() {
  const [isWalletConnected, setIsWalletConnected] = useState(false);

  const handleConnectWallet = () => {
    setIsWalletConnected(true);
  };

  return (
    <div className="min-h-screen bg-background">
      <Header 
        isWalletConnected={isWalletConnected}
        onWalletConnect={handleConnectWallet}
      />
      <main className="flex items-center justify-center py-8">
        <SwapInterface 
          isWalletConnected={isWalletConnected}
          onConnectWallet={handleConnectWallet}
        />
      </main>
    </div>
  );
}
