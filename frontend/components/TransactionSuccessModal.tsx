"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X, ExternalLink, Copy, CheckCircle } from "lucide-react";
import { useState } from "react";

interface TransactionSuccessModalProps {
  isOpen: boolean;
  onClose: () => void;
  polygonTxHash?: string;
  nearTxHash?: string;
}

export const TransactionSuccessModal = ({ 
  isOpen, 
  onClose, 
  polygonTxHash,
  nearTxHash
}: TransactionSuccessModalProps) => {
  const [copiedPolygon, setCopiedPolygon] = useState(false);
  const [copiedNear, setCopiedNear] = useState(false);

  const polygonExplorerUrl = "https://polygonscan.com/address/0x77ed0fef5e9dfb34e776adb11c29dd19d382745c";
  const nearExplorerUrl = "https://testnet.nearblocks.io/address/flexlock-1inch.testnet";
  
  // Display addresses
  const polygonDisplayAddress = "0x77ed0fef5e9dfb34e776adb11c29dd19d382745c";
  const nearDisplayAddress = "flexlock-1inch.testnet";

  // Function to shorten long addresses
  const shortenAddress = (address: string, maxLength: number = 20) => {
    if (address.length <= maxLength) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const copyToClipboard = async (text: string, type: 'polygon' | 'near') => {
    try {
      await navigator.clipboard.writeText(text);
      if (type === 'polygon') {
        setCopiedPolygon(true);
        setTimeout(() => setCopiedPolygon(false), 2000);
      } else {
        setCopiedNear(true);
        setTimeout(() => setCopiedNear(false), 2000);
      }
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg bg-card border-border">
        <DialogHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div>
            <DialogTitle className="text-foreground text-lg flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Transaction Successful
            </DialogTitle>
            <DialogDescription className="text-muted-foreground mt-1">
              Your cross-chain swap has been completed successfully
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
          {/* Success Icon */}
          <div className="flex justify-center">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </div>

          {/* Transaction Details */}
          <div className="space-y-4">
            {/* Polygon Transaction */}
            <div className="bg-swap-input rounded-lg p-4 space-y-3">
              <h3 className="font-medium text-foreground">Polygon Network</h3>
              
              {/* Explorer Link */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Address:</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono bg-background px-2 py-1 rounded">
                    {shortenAddress(polygonDisplayAddress)}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => window.open(polygonExplorerUrl, '_blank')}
                    className="h-8 w-8 text-primary hover:text-primary/80"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(polygonExplorerUrl, 'polygon')}
                    className="h-8 w-8"
                  >
                    {copiedPolygon ? (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Transaction Hash */}
              {polygonTxHash && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tx Hash:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono bg-background px-2 py-1 rounded">
                      {`${polygonTxHash.slice(0, 6)}...${polygonTxHash.slice(-4)}`}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(polygonTxHash, 'polygon')}
                      className="h-8 w-8"
                    >
                      {copiedPolygon ? (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {/* NEAR Transaction */}
            <div className="bg-swap-input rounded-lg p-4 space-y-3">
              <h3 className="font-medium text-foreground">NEAR Network</h3>
              
              {/* Explorer Link */}
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Address:</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono bg-background px-2 py-1 rounded">
                    {nearDisplayAddress}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => window.open(nearExplorerUrl, '_blank')}
                    className="h-8 w-8 text-primary hover:text-primary/80"
                  >
                    <ExternalLink className="h-3 w-3" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => copyToClipboard(nearExplorerUrl, 'near')}
                    className="h-8 w-8"
                  >
                    {copiedNear ? (
                      <CheckCircle className="h-3 w-3 text-green-500" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Transaction Hash */}
              {nearTxHash && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Tx Hash:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono bg-background px-2 py-1 rounded">
                      {`${nearTxHash.slice(0, 6)}...${nearTxHash.slice(-4)}`}
                    </span>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => copyToClipboard(nearTxHash, 'near')}
                      className="h-8 w-8"
                    >
                      {copiedNear ? (
                        <CheckCircle className="h-3 w-3 text-green-500" />
                      ) : (
                        <Copy className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Button */}
          <div className="flex justify-center pt-2">
            <Button
              onClick={onClose}
              className="px-8 bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
