"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ArrowUpDown, RefreshCw, Shuffle } from "lucide-react";
import { useState } from "react";
import { TokenSelectModal } from "./TokenSelectModal";
import { TransactionModal } from "./TransactionModal";
import { ConfirmSwapModal } from "./ConfirmSwapModal";

interface Token {
  symbol: string;
  name: string;
  icon: string;
  balance: string;
  networks: number;
}

interface SwapInterfaceProps {
  isWalletConnected?: boolean;
  onConnectWallet?: () => void;
}

export const SwapInterface = ({ isWalletConnected = false, onConnectWallet }: SwapInterfaceProps) => {
  const [fromToken, setFromToken] = useState<Token>({
    symbol: "ETH",
    name: "Ether",
    icon: "🔵",
    balance: "$0",
    networks: 11
  });
  
  const [toToken, setToToken] = useState<Token>({
    symbol: "USDS",
    name: "USDS Stablecoin",
    icon: "🟢",
    balance: "$0",
    networks: 1
  });
  
  const [fromAmount, setFromAmount] = useState("1");
  const [toAmount, setToAmount] = useState("3789.41481");
  const [isFromTokenModalOpen, setIsFromTokenModalOpen] = useState(false);
  const [isToTokenModalOpen, setIsToTokenModalOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSigningModalOpen, setIsSigningModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isCompletedModalOpen, setIsCompletedModalOpen] = useState(false);

  const handleSwapTokens = () => {
    const tempToken = fromToken;
    const tempAmount = fromAmount;
    setFromToken(toToken);
    setToToken(tempToken);
    setFromAmount(toAmount);
    setToAmount(tempAmount);
  };

  const handlePermitAndSwap = () => {
    // Show signing modal
    setIsSigningModalOpen(true);
    
    // Simulate signing process
    setTimeout(() => {
      setIsSigningModalOpen(false);
      setIsConfirmModalOpen(true);
    }, 3000);
  };

  const handleConfirmSwap = () => {
    setIsConfirmModalOpen(false);
    setIsCompletedModalOpen(true);
    
    // Auto close completion modal after 3 seconds
    setTimeout(() => {
      setIsCompletedModalOpen(false);
    }, 3000);
  };

  return (
    <div className="max-w-md mx-auto p-4">
      <Card className="bg-swap-card border-border">
        <CardContent className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                className="text-foreground font-medium border-b-2 border-primary pb-1"
              >
                Swap
              </Button>
              <Button variant="ghost" className="text-muted-foreground">
                Limit
              </Button>
            </div>
            <div className="flex items-center space-x-2">
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <RefreshCw className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <Shuffle className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* You pay */}
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">You pay</div>
            <div className="bg-swap-input rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <Button
                  variant="ghost"
                  className="p-0 h-auto text-foreground hover:text-primary"
                  onClick={() => setIsFromTokenModalOpen(true)}
                >
                  <div className="flex items-center space-x-2">
                    <span className="text-xl">{fromToken.icon}</span>
                    <span className="font-medium">{fromToken.symbol}</span>
                    <ChevronDown className="h-4 w-4" />
                  </div>
                </Button>
                <Input
                  value={fromAmount}
                  onChange={(e) => setFromAmount(e.target.value)}
                  className="text-right text-2xl font-semibold bg-transparent border-none p-0 h-auto text-foreground"
                  placeholder="0"
                />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {fromToken.name}
                </span>
                <span className="text-muted-foreground">~$3 774.15</span>
              </div>
            </div>

            {/* Swap button */}
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSwapTokens}
                className="rounded-full bg-swap-input hover:bg-accent border border-border w-10 h-10"
              >
                <ArrowUpDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>

            {/* You receive */}
            <div>
              <div className="text-sm text-muted-foreground mb-2">You receive</div>
              <div className="bg-swap-input rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <Button
                    variant="ghost"
                    className="p-0 h-auto text-foreground hover:text-primary"
                    onClick={() => setIsToTokenModalOpen(true)}
                  >
                    <div className="flex items-center space-x-2">
                      <span className="text-xl">{toToken.icon}</span>
                      <span className="font-medium">{toToken.symbol}</span>
                      <ChevronDown className="h-4 w-4" />
                    </div>
                  </Button>
                  <Input
                    value={toAmount}
                    onChange={(e) => setToAmount(e.target.value)}
                    className="text-right text-2xl font-semibold bg-transparent border-none p-0 h-auto text-foreground"
                    placeholder="0"
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {toToken.name}
                  </span>
                  <span className="text-muted-foreground">~$3 799.42</span>
                </div>
              </div>
            </div>

            {/* Exchange rate */}
            <div className="text-sm text-muted-foreground">
              1 ETH = 3789.41 USDS ~$3 799.4
            </div>

            {/* Advanced settings toggle */}
            <Button
              variant="ghost"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full text-xs text-muted-foreground hover:text-foreground"
            >
              <ChevronDown className={`h-3 w-3 mr-1 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
              {showAdvanced ? 'Hide' : 'Show'} advanced settings
            </Button>

            {/* Advanced settings */}
            {showAdvanced && (
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Slippage tolerance</span>
                  <div className="flex items-center space-x-2">
                    <span className="text-foreground">Auto 0.5%</span>
                  </div>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Minimum receive</span>
                  <span className="text-foreground">~$3 864.8 3 867.43928 USDS</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Network Fee</span>
                  <div className="flex items-center space-x-1">
                    <span className="text-primary text-xs">🔥 Free</span>
                    <span className="text-muted-foreground">$8.13</span>
                  </div>
                </div>
              </div>
            )}

            {/* Connect wallet / Permit and swap button */}
            {isWalletConnected ? (
              <Button 
                onClick={handlePermitAndSwap}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 text-lg font-medium"
              >
                Permit and swap
              </Button>
            ) : (
              <Button 
                onClick={onConnectWallet}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 text-lg font-medium"
              >
                Connect wallet
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Token selection modals */}
      <TokenSelectModal
        isOpen={isFromTokenModalOpen}
        onClose={() => setIsFromTokenModalOpen(false)}
        onSelectToken={(token) => setFromToken(token)}
      />
      <TokenSelectModal
        isOpen={isToTokenModalOpen}
        onClose={() => setIsToTokenModalOpen(false)}
        onSelectToken={(token) => setToToken(token)}
      />

      {/* Transaction modals */}
      <TransactionModal
        isOpen={isSigningModalOpen}
        onClose={() => setIsSigningModalOpen(false)}
        title="Please, sign the transaction in your wallet"
        description=""
        showCloseButton={true}
      />

      <ConfirmSwapModal
        isOpen={isConfirmModalOpen}
        onClose={() => setIsConfirmModalOpen(false)}
        onConfirm={handleConfirmSwap}
        fromToken={{
          symbol: fromToken.symbol,
          name: fromToken.name,
          icon: fromToken.icon,
          amount: fromAmount,
          usdValue: "~$0.00374398"
        }}
        toToken={{
          symbol: toToken.symbol,
          name: toToken.name,
          icon: toToken.icon,
          amount: toAmount,
          usdValue: "~$0.00373131"
        }}
      />

      <TransactionModal
        isOpen={isCompletedModalOpen}
        onClose={() => setIsCompletedModalOpen(false)}
        title="Transaction completed"
        description="Your swap has been successfully processed"
        showCloseButton={false}
      />
    </div>
  );
};