"use client";

import { Header } from "@/components/Header";
import { SwapInterface } from "@/components/SwapInterface";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="flex items-center justify-center py-8">
        <SwapInterface />
      </main>
    </div>
  );
}
