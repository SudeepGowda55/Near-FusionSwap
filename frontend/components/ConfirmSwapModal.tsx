"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ChevronLeft, ChevronDown } from "lucide-react";

interface ConfirmSwapModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  fromToken: {
    symbol: string;
    name: string;
    icon: string;
    amount: string;
    usdValue: string;
  };
  toToken: {
    symbol: string;
    name: string;
    icon: string;
    amount: string;
    usdValue: string;
  };
}

export const ConfirmSwapModal = ({ 
  isOpen, 
  onClose, 
  onConfirm,
  fromToken,
  toToken
}: ConfirmSwapModalProps) => {
  // ✅ Determine if this is a cross-chain swap
  const isCrossChain = fromToken.symbol === 'NEAR' || toToken.symbol === 'NEAR';
  const fromChain = fromToken.symbol === 'NEAR' ? 'NEAR' : 'Polygon';
  const toChain = toToken.symbol === 'NEAR' ? 'NEAR' : 'Polygon';

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="bg-background border-border max-w-md mx-auto p-0">
        <DialogHeader className="sr-only">
          <DialogTitle>Confirm swap</DialogTitle>
          <DialogDescription>Review your swap details before confirming</DialogDescription>
        </DialogHeader>
        <div className="p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="text-muted-foreground hover:text-foreground"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <h2 className="text-xl font-semibold text-foreground">
              {isCrossChain ? 'Confirm Cross-Chain Swap' : 'Confirm Swap'}
            </h2>
            <div className="w-10"></div>
          </div>

          {/* ✅ Cross-chain warning banner */}
          {isCrossChain && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-4">
              <p className="text-blue-400 text-sm font-medium">
                🌉 Cross-Chain Swap
              </p>
              <p className="text-blue-300 text-xs mt-1">
                This swap will bridge tokens between {fromChain} and {toChain} networks using HTLC contracts.
              </p>
            </div>
          )}

          {/* Token swap details */}
          <div className="space-y-4 mb-6">
            {/* From token */}
            <div className="bg-swap-input rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <span className="text-2xl">{fromToken.icon}</span>
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center ${
                      fromToken.symbol === 'NEAR' ? 'bg-green-600' : 'bg-purple-600'
                    }`}>
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">{fromToken.symbol}</div>
                    <div className="text-sm text-muted-foreground">
                      on {fromChain}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-foreground">{fromToken.amount}</div>
                  <div className="text-sm text-muted-foreground">{fromToken.usdValue}</div>
                </div>
              </div>
            </div>

            {/* Arrow down with bridge indicator */}
            <div className="flex justify-center items-center space-x-2">
              <div className="w-8 h-8 bg-swap-input rounded-full flex items-center justify-center border border-border">
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </div>
              {isCrossChain && (
                <span className="text-xs text-blue-400 font-medium">BRIDGE</span>
              )}
            </div>

            {/* To token */}
            <div className="bg-swap-input rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <span className="text-2xl">{toToken.icon}</span>
                    <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center ${
                      toToken.symbol === 'NEAR' ? 'bg-green-600' : 'bg-purple-600'
                    }`}>
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">{toToken.symbol}</div>
                    <div className="text-sm text-muted-foreground">
                      on {toChain}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-foreground">{toToken.amount}</div>
                  <div className="text-sm text-muted-foreground">{toToken.usdValue}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Swap details */}
          <div className="space-y-3 mb-6 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Exchange Rate</span>
              <span className="text-foreground">
                1 {fromToken.symbol} ≈ {(parseFloat(toToken.amount) / parseFloat(fromToken.amount)).toFixed(6)} {toToken.symbol}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">
                {isCrossChain ? 'Bridge Fee' : 'Slippage tolerance'}
              </span>
              <span className="text-foreground">
                {isCrossChain ? '~$2.50' : 'Auto 0.5%'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Minimum receive</span>
              <span className="text-foreground">
                {(parseFloat(toToken.amount) * 0.995).toFixed(6)} {toToken.symbol}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Network Fee</span>
              <span className="text-foreground">
                {isCrossChain ? '~$0.50' : '~$0.10'}
              </span>
            </div>
            {isCrossChain && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Estimated Time</span>
                <span className="text-foreground">5-10 minutes</span>
              </div>
            )}
          </div>

          {/* Cross-chain specific settings */}
          {isCrossChain && (
            <div className="space-y-3 mb-6">
              <div className="flex items-center justify-between p-3 bg-swap-input rounded-lg">
                <div>
                  <span className="text-foreground text-sm">Enable automatic claiming</span>
                  <p className="text-xs text-muted-foreground">
                    Automatically claim tokens when cross-chain transfer completes
                  </p>
                </div>
                <Switch defaultChecked />
              </div>
            </div>
          )}

          {/* Regular receive to another wallet toggle for non-cross-chain */}
          {!isCrossChain && (
            <div className="flex items-center justify-between mb-6 p-3 bg-swap-input rounded-lg">
              <span className="text-foreground">Receive {toToken.symbol} to another wallet</span>
              <Switch />
            </div>
          )}

          {/* Confirm button */}
          <Button 
            onClick={onConfirm}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 text-lg font-medium"
          >
            {isCrossChain ? 'Confirm Cross-Chain Swap' : 'Confirm Swap'}
          </Button>
          
          {/* Cross-chain disclaimer */}
          {isCrossChain && (
            <p className="text-xs text-muted-foreground text-center mt-3">
              Cross-chain swaps use Hash Time Locked Contracts (HTLC) for secure bridging. 
              The process may take several minutes to complete.
            </p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
