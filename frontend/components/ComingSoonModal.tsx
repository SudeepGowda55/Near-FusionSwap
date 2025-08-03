"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, Clock, Zap } from "lucide-react";

interface ComingSoonModalProps {
  isOpen: boolean;
  onClose: () => void;
  fromToken: string;
  toToken: string;
}

export const ComingSoonModal = ({ 
  isOpen, 
  onClose, 
  fromToken,
  toToken
}: ComingSoonModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <DialogTitle className="text-foreground text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-500" />
              Coming Soon
            </DialogTitle>
            <DialogDescription className="text-muted-foreground mt-1">
              This swap pair will be available soon
            </DialogDescription>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-6 w-6 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </Button>
        </DialogHeader>

        <div className="space-y-6">
          {/* Info Icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center">
              <Zap className="h-8 w-8 text-blue-500" />
            </div>
          </div>

          {/* Message */}
          <div className="text-center space-y-3">
            <h3 className="text-lg font-semibold text-foreground">
              {fromToken} → {toToken} Support Coming Soon
            </h3>
            <p className="text-muted-foreground text-sm leading-relaxed">
              We&apos;re working hard to bring you more cross-chain swap options. Currently, we support WETH to NEAR swaps on our platform.
            </p>
          </div>

          {/* Current Support Info */}
          <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <div className="w-5 h-5 bg-green-500 rounded-full flex items-center justify-center mt-0.5">
                <span className="text-white text-xs font-bold">✓</span>
              </div>
              <div>
                <h4 className="text-green-500 font-medium text-sm">Currently Supported</h4>
                <p className="text-green-600 text-xs mt-1">
                  <strong>WETH → NEAR</strong> - Full cross-chain swap functionality with HTLC security
                </p>
              </div>
            </div>
          </div>

          {/* Coming Soon Features */}
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <Clock className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-blue-500 font-medium text-sm">Coming Soon</h4>
                <ul className="text-blue-600 text-xs mt-1 space-y-1">
                  <li>• NEAR → WETH (Reverse swaps)</li>
                  <li>• USDC, USDT, DAI cross-chain support</li>
                  <li>• Additional EVM networks</li>
                  <li>• Enhanced liquidity options</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Call to Action */}
          <div className="text-center space-y-4">
            <p className="text-muted-foreground text-xs">
              Want to be notified when new pairs are available?
            </p>
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={onClose}
                className="flex-1 border-border hover:bg-accent"
              >
                Go Back
              </Button>
              <Button
                onClick={() => {
                  // You can add newsletter signup or notification logic here
                  window.open('https://github.com/SudeepGowda55/Near-FusionSwap', '_blank');
                }}
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                Follow Updates
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
