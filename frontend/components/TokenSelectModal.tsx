"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Search, ChevronLeft } from "lucide-react";
import { useState } from "react";

interface TokenSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectToken: (token: Token) => void;
}

interface Token {
  symbol: string;
  name: string;
  icon: string;
  balance: string;
  networks: number;
  price?: string;
}

const popularTokens = [
  { symbol: "ETH", icon: "🔵", name: "Ethereum" },
  { symbol: "SOL", icon: "⚪", name: "Solana" },
  { symbol: "USDC", icon: "🔵", name: "USD Coin" },
  { symbol: "USDT", icon: "🟢", name: "Tether USD" },
  { symbol: "WETH", icon: "🔵", name: "Wrapped Ethereum" },
  { symbol: "UNI", icon: "🦄", name: "Uniswap" },
  { symbol: "WBTC", icon: "🟡", name: "Wrapped Bitcoin" },
  { symbol: "BNB", icon: "🟡", name: "BNB" },
  { symbol: "1INCH", icon: "🦄", name: "1inch" }
];

const tokens: Token[] = [
  { symbol: "USDT", name: "Tether USD", icon: "🟢", balance: "$0", networks: 13 },
  { symbol: "ETH", name: "Ether", icon: "🔵", balance: "$0", networks: 11 },
  { symbol: "BNB", name: "BNB", icon: "🟡", balance: "$0", networks: 3 },
  { symbol: "USDC", name: "USD Coin", icon: "🔵", balance: "$0", networks: 13 },
  { symbol: "stETH", name: "Liquid staked Ether 2.0", icon: "🔵", balance: "$0", networks: 1 },
  { symbol: "wstETH", name: "Wrapped liquid staked Ether 2.0", icon: "🔵", balance: "$0", networks: 5 }
];

export const TokenSelectModal = ({ isOpen, onClose, onSelectToken }: TokenSelectModalProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [showNetworks, setShowNetworks] = useState(false);

  const filteredTokens = tokens.filter(token => 
    token.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
    token.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (showNetworks) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="sm:max-w-md bg-card border-border">
          <DialogHeader className="flex flex-row items-center space-y-0 pb-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowNetworks(false)}
              className="h-6 w-6 text-muted-foreground hover:text-foreground mr-3"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-medium">🌐</span>
              <DialogTitle className="text-foreground">All networks</DialogTitle>
            </div>
          </DialogHeader>
          
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="Search by name or paste address"
              className="pl-10 bg-swap-input border-border"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {/* Popular tokens */}
          <div className="flex flex-wrap gap-2 mb-4">
            {popularTokens.map((token) => (
              <Button
                key={token.symbol}
                variant="outline"
                size="sm"
                className="border-border bg-swap-input hover:bg-accent/50"
              >
                <span className="mr-1">{token.icon}</span>
                {token.symbol}
              </Button>
            ))}
          </div>
          
          {/* Token list */}
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {filteredTokens.map((token) => (
              <Button
                key={token.symbol}
                variant="ghost"
                className="w-full justify-between h-16 px-4 hover:bg-accent/50"
                onClick={() => {
                  onSelectToken(token);
                  onClose();
                }}
              >
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg">
                    {token.icon}
                  </div>
                  <div className="text-left">
                    <div className="font-medium text-foreground">{token.symbol}</div>
                    <div className="text-sm text-muted-foreground">
                      {token.balance} • {token.networks} networks
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-foreground">{token.balance}</div>
                </div>
              </Button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-card border-border">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <DialogTitle className="text-foreground">Select token</DialogTitle>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>
        
        <div className="relative mb-4">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Search by name or paste address"
            className="pl-10 bg-swap-input border-border"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        
        <Button
          variant="ghost"
          className="w-full justify-between h-12 px-4 mb-4 border border-border hover:bg-accent/50 bg-swap-input"
          onClick={() => setShowNetworks(true)}
        >
          <div className="flex items-center space-x-3">
            <span className="text-lg">🌐</span>
            <span className="text-foreground">All networks</span>
          </div>
          <span className="text-muted-foreground">›</span>
        </Button>
        
        {/* Popular tokens */}
        <div className="flex flex-wrap gap-2 mb-4">
          {popularTokens.map((token) => (
            <Button
              key={token.symbol}
              variant="outline"
              size="sm"
              className="border-border bg-swap-input hover:bg-accent/50"
              onClick={() => {
                onSelectToken({ ...token, balance: "$0", networks: 1 });
                onClose();
              }}
            >
              <span className="mr-1">{token.icon}</span>
              {token.symbol}
            </Button>
          ))}
        </div>
        
        {/* Token list */}
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {filteredTokens.map((token) => (
            <Button
              key={token.symbol}
              variant="ghost"
              className="w-full justify-between h-16 px-4 hover:bg-accent/50"
              onClick={() => {
                onSelectToken(token);
                onClose();
              }}
            >
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-lg">
                  {token.icon}
                </div>
                <div className="text-left">
                  <div className="font-medium text-foreground">{token.symbol}</div>
                  <div className="text-sm text-muted-foreground">
                    {token.balance} • {token.networks} networks
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-sm font-medium text-foreground">{token.balance}</div>
              </div>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
};