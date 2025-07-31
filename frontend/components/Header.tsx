"use client";

import { Button } from "@/components/ui/button";
import { ChevronDown, Settings, HelpCircle, Download } from "lucide-react";
import { useState } from "react";
import { ConnectWalletModal } from "./ConnectWalletModal";

export const Header = () => {
  const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);

  return (
    <header className="flex items-center justify-between p-4 border-b border-border">
      <div className="flex items-center space-x-8">
        <div className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-lg">1</span>
          </div>
          <span className="text-foreground font-semibold text-xl">1inch</span>
        </div>
        
        <nav className="flex items-center space-x-6">
          <Button variant="ghost" className="text-foreground hover:text-primary">
            Trade <ChevronDown className="ml-1 h-4 w-4" />
          </Button>
          <Button variant="ghost" className="text-muted-foreground hover:text-primary">
            Portfolio <ChevronDown className="ml-1 h-4 w-4" />
          </Button>
          <Button variant="ghost" className="text-muted-foreground hover:text-primary">
            DAO <ChevronDown className="ml-1 h-4 w-4" />
          </Button>
          <Button variant="ghost" className="text-muted-foreground hover:text-primary">
            Buy Crypto
          </Button>
          <Button variant="ghost" className="text-muted-foreground hover:text-primary">
            Card
          </Button>
        </nav>
      </div>
      
      <div className="flex items-center space-x-3">
        <Button 
          className="bg-primary hover:bg-primary/90 text-primary-foreground px-6"
          onClick={() => setIsWalletModalOpen(true)}
        >
          Connect wallet
        </Button>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
          <HelpCircle className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
          <Settings className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary">
          <Download className="h-5 w-5" />
        </Button>
      </div>

      <ConnectWalletModal 
        isOpen={isWalletModalOpen} 
        onClose={() => setIsWalletModalOpen(false)} 
      />
    </header>
  );
};