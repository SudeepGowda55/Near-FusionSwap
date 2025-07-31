"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";

interface ConnectWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  onWalletSelect?: () => void;
}

const wallets = [
  {
    name: "1inch Wallet",
    description: "Scan QR code to connect",
    icon: "🦄",
    action: "scan"
  },
  {
    name: "MetaMask",
    description: "Detected",
    icon: "🦊",
    detected: true
  },
  {
    name: "Phantom",
    description: "Detected", 
    icon: "👻",
    detected: true
  },
  {
    name: "WalletConnect",
    description: "",
    icon: "🔗",
  },
  {
    name: "Brave Wallet",
    description: "Detected",
    icon: "🛡️",
    detected: true
  }
];

export const ConnectWalletModal = ({ isOpen, onClose, onWalletSelect }: ConnectWalletModalProps) => {
  const handleWalletClick = () => {
    onClose();
    onWalletSelect?.();
  };
  
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <DialogTitle className="text-foreground">Connect wallet</DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        
        <DialogDescription className="text-sm text-muted-foreground mb-6">
          Connect wallet to make transactions on the dApp
        </DialogDescription>
        
        <div className="space-y-3">
          {wallets.map((wallet) => (
            <Button
              key={wallet.name}
              variant="ghost"
              onClick={handleWalletClick}
              className="w-full justify-between h-14 px-4 border border-border hover:bg-accent/50 bg-swap-input"
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg">
                  {wallet.icon}
                </div>
                <span className="text-foreground">{wallet.name}</span>
              </div>
              <div className="flex items-center space-x-2">
                {wallet.detected && (
                  <span className="text-xs text-primary">Detected</span>
                )}
                {wallet.action === "scan" && (
                  <span className="text-xs text-muted-foreground">Scan QR code to connect</span>
                )}
                <span className="text-muted-foreground">›</span>
              </div>
            </Button>
          ))}
        </div>
        
        <div className="mt-6 text-center">
          <Button variant="link" className="text-primary text-sm">
            More wallets
          </Button>
        </div>
        
        <div className="mt-4 text-xs text-muted-foreground text-center space-y-1">
          <p>
            By connecting your wallet, you agree to our{" "}
            <span className="text-primary">Terms of Use</span> and{" "}
            <span className="text-primary">Privacy Policy</span>.
          </p>
          <p>Last update of Terms of Use: 15/05/2025</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};