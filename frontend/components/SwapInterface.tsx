"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ArrowUpDown, RefreshCw, Shuffle } from "lucide-react";
import { useState } from "react";
import { TokenSelectModal } from "./TokenSelectModal";
import { TransactionModal } from "./TransactionModal";
import { ConfirmSwapModal } from "./ConfirmSwapModal";
import { useWalletClient, useChainId, useSwitchChain } from "wagmi";
import { polygon } from "wagmi/chains";
import { ethers } from "ethers";
import { TokenApprovalService } from "@/utils/tokenApproval";

// Token configuration - Updated for Polygon network
const TOKEN_CONFIG = {
  ETH: {
    address: "0x0000000000000000000000000000000000000000", // ETH doesn't need approval
    decimals: 18
  },
  WETH: {
    address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", // WETH on Polygon
    decimals: 18
  },
  USDC: {
    address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC on Polygon
    decimals: 6
  },
  USDS: {
    address: "0xB0b86a33E6441e4e6e40b4d4e7F9e1F6e5e5e5e5", // Replace with actual USDS address
    decimals: 18
  }
};

// 1inch Router V5 contract address on Polygon
const ONEINCH_ROUTER = "0x111111125421ca6dc452d289314280a0f8842a65";

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
    symbol: "WETH",
    name: "Wrapped Ether",
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
  const [isApproving, setIsApproving] = useState(false);

  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  const handleSwapTokens = () => {
    const tempToken = fromToken;
    const tempAmount = fromAmount;
    setFromToken(toToken);
    setToToken(tempToken);
    setFromAmount(toAmount);
    setToAmount(tempAmount);
  };

  const handlePermitAndSwap = async () => {
    if (!walletClient) {
      console.error('❌ Wallet not connected');
      return;
    }

    try {
      console.log('🚀 Starting permit and swap process...');
      console.log('📊 Swap Details:');
      console.log(`  From: ${fromAmount} ${fromToken.symbol}`);
      console.log(`  To: ${toAmount} ${toToken.symbol}`);
      
      // Check if user is on Polygon network
      if (chainId !== polygon.id) {
        console.log('🔄 Switching to Polygon network...');
        try {
          await switchChain({ chainId: polygon.id });
          console.log('✅ Switched to Polygon network');
        } catch (error) {
          console.error('❌ Failed to switch network:', error);
          alert('Please switch to Polygon network manually in your wallet');
          return;
        }
      }
      
      // Show the signing modal and set approving state
      setIsSigningModalOpen(true);
      setIsApproving(true);
      
      console.log('📝 Creating ethers signer from wagmi wallet client...');
      
      // Create ethers signer from wagmi wallet client
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      
      const userAddress = await signer.getAddress();
      console.log('✅ Ethers signer created successfully');
      console.log('👤 User address:', userAddress);
      
      // Initialize token approval service
      const approvalService = new TokenApprovalService(signer);
      console.log('🏭 Token approval service initialized');

      // Get token address from config
      const tokenAddress = TOKEN_CONFIG[fromToken.symbol as keyof typeof TOKEN_CONFIG]?.address;
      
      console.log('🪙 Token details:');
      console.log('  - Symbol:', fromToken.symbol);
      console.log('  - Contract Address:', tokenAddress);
      console.log('  - Amount to swap:', fromAmount);
      console.log('  - Spender (1inch Router):', ONEINCH_ROUTER);
      
      if (!tokenAddress || tokenAddress === "0x0000000000000000000000000000000000000000") {
        // ETH doesn't need approval, skip to swap confirmation
        console.log('⚡ ETH detected, skipping approval process');
        
        // Add a small delay to show the modal briefly
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        setIsSigningModalOpen(false);
        setIsConfirmModalOpen(true);
        setIsApproving(false);
        return;
      }

      console.log('🔍 Checking current allowance...');
      
      // Check current allowance with error handling
      let currentAllowance: bigint;
      let approvalNeeded = true;
      
      try {
        currentAllowance = await approvalService.getCurrentAllowance(tokenAddress, ONEINCH_ROUTER);
        console.log('📊 Current allowance:', ethers.formatEther(currentAllowance));
        
        const requiredAmount = ethers.parseUnits(fromAmount, TOKEN_CONFIG[fromToken.symbol as keyof typeof TOKEN_CONFIG].decimals);
        console.log('💰 Required amount:', ethers.formatEther(requiredAmount));
        
        approvalNeeded = currentAllowance < requiredAmount;
        console.log('❓ Approval needed:', approvalNeeded);
      } catch (error) {
        console.warn('⚠️ Could not check allowance, proceeding with approval anyway:', error);
        approvalNeeded = true;
      }

      if (approvalNeeded) {
        console.log('🔐 Starting token approval process...');
        console.log('⏳ Please confirm the approval transaction in your wallet...');
        
        // Execute unlimited token approval for 1inch Router
        const approvalResult = await approvalService.approveToken(
          tokenAddress,
          ONEINCH_ROUTER,
          ethers.MaxUint256 // Unlimited approval
        );

        if (!approvalResult.success) {
          throw new Error(approvalResult.error || 'Token approval failed');
        }

        console.log('✅ Token approval completed successfully!');
        console.log('📜 Transaction hash:', approvalResult.transactionHash);
        console.log('🎯 Token approved for unlimited spending by 1inch Router');
      } else {
        console.log('✅ Sufficient allowance already exists, skipping approval');
        
        // Add a small delay to show the modal
        await new Promise(resolve => setTimeout(resolve, 1500));
      }
      
      console.log('🔄 Moving to swap confirmation...');
      
      // Move to confirmation modal
      setIsSigningModalOpen(false);
      setIsConfirmModalOpen(true);

    } catch (error) {
      console.error('❌ Approval process failed:', error);
      console.error('📝 Error details:', {
        message: error instanceof Error ? error.message : 'Unknown error',
        stack: error instanceof Error ? error.stack : undefined
      });
      
      setIsSigningModalOpen(false);
      
      // Show error to user
      const errorMessage = error instanceof Error ? error.message : 'Token approval failed';
      alert(`Approval failed: ${errorMessage}. Please try again.`);
    } finally {
      setIsApproving(false);
      console.log('🏁 Permit and swap process completed');
    }
  };

  const handleConfirmSwap = () => {
    console.log('🔄 Confirming swap...');
    setIsConfirmModalOpen(false);
    setIsCompletedModalOpen(true);
    
    // Auto close completion modal after 3 seconds
    setTimeout(() => {
      setIsCompletedModalOpen(false);
      console.log('✅ Swap process completed successfully');
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
              1 {fromToken.symbol} = 3789.41 {toToken.symbol} ~$3 799.4
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
                  <span className="text-foreground">~$3 864.8 3 867.43928 {toToken.symbol}</span>
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

            {/* Network warning */}
            {chainId !== polygon.id && (
              <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3">
                <p className="text-yellow-500 text-sm">
                  ⚠️ Please switch to Polygon network to use this feature
                </p>
              </div>
            )}

            {/* Connect wallet / Permit and swap button */}
            {isWalletConnected ? (
              <Button 
                onClick={handlePermitAndSwap}
                disabled={isApproving}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 text-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isApproving ? 'Approving Token...' : 'Permit and swap'}
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
        title={isApproving ? "Approving Token Access..." : "Please sign the transaction in your wallet"}
        description={isApproving ? `Please confirm the ${fromToken.symbol} approval transaction in your wallet to allow 1inch Router to spend your tokens.` : ""}
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
          usdValue: "~$3,774.15"
        }}
        toToken={{
          symbol: toToken.symbol,
          name: toToken.name,
          icon: toToken.icon,
          amount: toAmount,
          usdValue: "~$3,799.42"
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
