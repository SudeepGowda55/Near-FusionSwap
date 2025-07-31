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
              Confirm swap
            </h2>
            <div className="w-10"></div>
          </div>

          {/* Token swap details */}
          <div className="space-y-4 mb-6">
            {/* From token */}
            <div className="bg-swap-input rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <span className="text-2xl">{fromToken.icon}</span>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-purple-600 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">{fromToken.symbol}</div>
                    <div className="text-sm text-muted-foreground">on Polygon</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-foreground">{fromToken.amount}</div>
                  <div className="text-sm text-muted-foreground">{fromToken.usdValue}</div>
                </div>
              </div>
            </div>

            {/* Arrow down */}
            <div className="flex justify-center">
              <div className="w-8 h-8 bg-swap-input rounded-full flex items-center justify-center border border-border">
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </div>
            </div>

            {/* To token */}
            <div className="bg-swap-input rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <span className="text-2xl">{toToken.icon}</span>
                    <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-purple-600 rounded-full flex items-center justify-center">
                      <div className="w-2 h-2 bg-white rounded-full"></div>
                    </div>
                  </div>
                  <div>
                    <div className="font-semibold text-foreground">{toToken.symbol}</div>
                    <div className="text-sm text-muted-foreground">on Polygon</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-semibold text-foreground">{toToken.amount}</div>
                  <div className="text-sm text-muted-foreground">{toToken.usdValue} (-0.34%)</div>
                </div>
              </div>
            </div>
          </div>

          {/* Swap details */}
          <div className="space-y-3 mb-6 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Price</span>
              <span className="text-foreground">~$3 743.9 1 WETH = 3728 USDC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Slippage tolerance</span>
              <span className="text-foreground">Auto 0.5%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Minimum receive</span>
              <span className="text-foreground">~$0.00371229 0.003709 USDC</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Network Fee</span>
              <span className="text-foreground">Market &lt;$0.01</span>
            </div>
          </div>

          {/* Receive to another wallet toggle */}
          <div className="flex items-center justify-between mb-6 p-3 bg-swap-input rounded-lg">
            <span className="text-foreground">Receive USDC_1 to another wallet</span>
            <Switch />
          </div>

          {/* Confirm button */}
          <Button 
            onClick={onConfirm}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 text-lg font-medium"
          >
            Confirm swap
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};