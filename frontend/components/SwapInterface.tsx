"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { ChevronDown, ArrowUpDown, RefreshCw, Shuffle } from "lucide-react";
import { useState, useEffect } from "react";
import { TokenSelectModal } from "./TokenSelectModal";
import { TransactionModal } from "./TransactionModal";
import { ConfirmSwapModal } from "./ConfirmSwapModal";
import { useWalletClient, useChainId, useSwitchChain } from "wagmi";
import { polygon } from "wagmi/chains";
import { ethers } from "ethers";
import { TokenApprovalService } from "@/utils/tokenApproval";
import { useTokenPrices } from "@/hooks/useTokenPrices";
import { priceService } from "@/utils/priceService";

// Token configuration - Updated for Polygon network
const TOKEN_CONFIG = {
  ETH: {
    address: "0x0000000000000000000000000000000000000000",
    decimals: 18
  },
  WETH: {
    address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", // Correct WETH
    decimals: 18
  },
  USDC: {
    address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC address
    decimals: 6
  },
  USDT: {
    address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    decimals: 6
  },
  DAI: {
    address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
    decimals: 18
  },
  NEAR: {
    address: "0x85f17cf997934a597031b2e18a9ab6ebd4b9f6a4", // NEAR bridged token
    decimals: 24 // NEAR uses 24 decimals
  },
  MATIC: {
    address: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270", // Native MATIC
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
    symbol: "NEAR",
    name: "NEAR Protocol",
    icon: "🌈",
    balance: "$0",
    networks: 1
  });
  
  const [fromAmount, setFromAmount] = useState("1");
  const [toAmount, setToAmount] = useState("0");
  const [isFromTokenModalOpen, setIsFromTokenModalOpen] = useState(false);
  const [isToTokenModalOpen, setIsToTokenModalOpen] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSigningModalOpen, setIsSigningModalOpen] = useState(false);
  const [isConfirmModalOpen, setIsConfirmModalOpen] = useState(false);
  const [isCompletedModalOpen, setIsCompletedModalOpen] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [approvalTxHash, setApprovalTxHash] = useState<string | null>(null);

  const { data: walletClient } = useWalletClient();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  // Debug chain detection
  console.log('🔗 Chain detection:', {
    chainId,
    isWalletConnected,
    polygonId: polygon.id,
    isPolygon: chainId === polygon.id
  });

  // Use price hook for both tokens
  const { 
    loading: pricesLoading, 
    error: priceError,
    getTokenPrice, 
    calculateUSDValue,
    refetch: refetchPrices 
  } = useTokenPrices([fromToken.symbol, toToken.symbol, "NEAR", "WETH"]);

  // Calculate exchange rate and amounts when prices or amounts change
  useEffect(() => {
    if (fromAmount && parseFloat(fromAmount) > 0) {
      const fromPrice = getTokenPrice(fromToken.symbol);
      const toPrice = getTokenPrice(toToken.symbol);
      
      if (parseFloat(fromPrice) > 0 && parseFloat(toPrice) > 0) {
        const fromValueUSD = parseFloat(fromAmount) * parseFloat(fromPrice);
        const calculatedToAmount = fromValueUSD / parseFloat(toPrice);
        setToAmount(calculatedToAmount.toFixed(6));
      }
    }
  }, [fromAmount, fromToken.symbol, toToken.symbol, getTokenPrice]);

  // Enhanced swap tokens function that properly handles bidirectional swaps
  const handleSwapTokens = () => {
    console.log('🔄 Swapping tokens...');
    console.log('📊 Before swap:');
    console.log(`  From: ${fromAmount} ${fromToken.symbol}`);
    console.log(`  To: ${toAmount} ${toToken.symbol}`);
    
    const tempToken = fromToken;
    const tempAmount = fromAmount;
    
    setFromToken(toToken);
    setToToken(tempToken);
    setFromAmount(toAmount);
    setToAmount(tempAmount);
    
    console.log('📊 After swap:');
    console.log(`  From: ${toAmount} ${toToken.symbol}`);
    console.log(`  To: ${tempAmount} ${tempToken.symbol}`);
  };

  // Enhanced token selection that ensures both WETH and NEAR are available
  const handleFromTokenSelect = (token: Token) => {
    console.log('🎯 Selected from token:', token.symbol);
    setFromToken(token);
    
    // If the same token is selected for both, swap the "to" token
    if (token.symbol === toToken.symbol) {
      const availableTokens = [
        { symbol: "WETH", name: "Wrapped Ether", icon: "🔵", balance: "$0", networks: 11 },
        { symbol: "NEAR", name: "NEAR Protocol", icon: "🌈", balance: "$0", networks: 1 },
        { symbol: "USDC", name: "USD Coin", icon: "🔵", balance: "$0", networks: 13 },
        { symbol: "USDT", name: "Tether USD", icon: "🟢", balance: "$0", networks: 13 }
      ];
      
      const otherToken = availableTokens.find(t => t.symbol !== token.symbol);
      if (otherToken) {
        setToToken(otherToken);
        console.log('🔄 Auto-swapped to token to:', otherToken.symbol);
      }
    }
  };

  const handleToTokenSelect = (token: Token) => {
    console.log('🎯 Selected to token:', token.symbol);
    setToToken(token);
    
    // If the same token is selected for both, swap the "from" token
    if (token.symbol === fromToken.symbol) {
      const availableTokens = [
        { symbol: "WETH", name: "Wrapped Ether", icon: "🔵", balance: "$0", networks: 11 },
        { symbol: "NEAR", name: "NEAR Protocol", icon: "🌈", balance: "$0", networks: 1 },
        { symbol: "USDC", name: "USD Coin", icon: "🔵", balance: "$0", networks: 13 },
        { symbol: "USDT", name: "Tether USD", icon: "🟢", balance: "$0", networks: 13 }
      ];
      
      const otherToken = availableTokens.find(t => t.symbol !== token.symbol);
      if (otherToken) {
        setFromToken(otherToken);
        console.log('🔄 Auto-swapped from token to:', otherToken.symbol);
      }
    }
  };

  // ✅ NEW: Function to wait for transaction confirmation
  const waitForTransactionConfirmation = async (
    txHash: string, 
    provider: ethers.BrowserProvider,
    maxWaitTime: number = 300000 // 5 minutes
  ): Promise<ethers.TransactionReceipt | null> => {
    console.log('⏳ Waiting for transaction confirmation:', txHash);
    
    const startTime = Date.now();
    let receipt = null;
    
    while (Date.now() - startTime < maxWaitTime) {
      try {
        receipt = await provider.getTransactionReceipt(txHash);
        if (receipt) {
          if (receipt.status === 1) {
            console.log('✅ Transaction confirmed successfully:', txHash);
            return receipt;
          } else {
            console.error('❌ Transaction failed:', txHash);
            throw new Error('Transaction failed on blockchain');
          }
        }
        
        // Wait 2 seconds before next check
        await new Promise(resolve => setTimeout(resolve, 2000));
        console.log('⏳ Still waiting for confirmation...');
        
      } catch (error) {
        console.error('⚠️ Error checking transaction status:', error);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
    
    throw new Error('Transaction confirmation timeout');
  };

  // ✅ NEW: Function to validate current allowance after approval
  const validateApprovalSuccess = async (
    tokenAddress: string,
    spenderAddress: string,
    requiredAmount: bigint,
    approvalService: TokenApprovalService
  ): Promise<boolean> => {
    try {
      console.log('🔍 Validating approval success...');
      
      // Wait a bit for blockchain state to update
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const currentAllowance = await approvalService.getCurrentAllowance(tokenAddress, spenderAddress);
      console.log('📊 Current allowance after approval:', ethers.formatEther(currentAllowance));
      console.log('💰 Required amount:', ethers.formatEther(requiredAmount));
      
      const isApproved = currentAllowance >= requiredAmount;
      console.log('✅ Approval validation result:', isApproved);
      
      return isApproved;
    } catch (error) {
      console.error('❌ Failed to validate approval:', error);
      return false;
    }
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
      console.log(`  Direction: ${fromToken.symbol} → ${toToken.symbol}`);
      
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

      // Handle NEAR tokens differently - they don't need ERC-20 approval
      if (fromToken.symbol === 'NEAR') {
        console.log('🌈 NEAR token detected - processing cross-chain swap...');
        console.log('📝 NEAR tokens require cross-chain bridge interaction');
        
        // ✅ Call your backend API for NEAR cross-chain swap
        try {
          const swapResponse = await fetch('http://localhost:3001/near-to-polygon', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              fromChain: 'near',
              toChain: 'polygon',
              fromToken: 'NEAR',
              toToken: toToken.symbol,
              fromAmount: ethers.parseUnits(fromAmount, 24).toString(), // NEAR uses 24 decimals
              toAmount: ethers.parseUnits(toAmount, TOKEN_CONFIG[toToken.symbol as keyof typeof TOKEN_CONFIG].decimals).toString(),
              maker: 'flexlock-swap.testnet',
              resolver: 'htlc.testnet'
            })
          });

          if (!swapResponse.ok) {
            throw new Error('Cross-chain swap initiation failed');
          }

          const swapResult = await swapResponse.json();
          console.log('✅ Cross-chain swap initiated:', swapResult);
          
          // Add a delay to show the modal
          await new Promise(resolve => setTimeout(resolve, 2000));
          
          setIsSigningModalOpen(false);
          setIsConfirmModalOpen(true);
          setIsApproving(false);
          return;
          
        } catch (error) {
          console.error('❌ Cross-chain swap failed:', error);
          throw new Error('Failed to initiate cross-chain swap');
        }
      }
      
      // Initialize token approval service for ERC-20 tokens
      const approvalService = new TokenApprovalService(signer);
      console.log('🏭 Token approval service initialized');

      // Get token address from config - only for ERC-20 tokens
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
      const requiredAmount = ethers.parseUnits(fromAmount, TOKEN_CONFIG[fromToken.symbol as keyof typeof TOKEN_CONFIG].decimals);
      
      try {
        currentAllowance = await approvalService.getCurrentAllowance(tokenAddress, ONEINCH_ROUTER);
        console.log('📊 Current allowance:', ethers.formatEther(currentAllowance));
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

        console.log('✅ Approval transaction submitted!');
        console.log('📜 Transaction hash:', approvalResult.transactionHash);
        
        // ✅ Store the transaction hash for validation
        setApprovalTxHash(approvalResult.transactionHash!);

        // ✅ Wait for transaction confirmation  
        console.log('⏳ Waiting for approval transaction to be confirmed...');
        
        try {
          const receipt = await waitForTransactionConfirmation(
            approvalResult.transactionHash!,
            provider,
            300000 // 5 minutes timeout
          );

          if (!receipt) {
            throw new Error('Transaction confirmation timeout');
          }

          console.log('✅ Approval transaction confirmed on blockchain!');
          console.log('📊 Gas used:', receipt.gasUsed.toString());
          console.log('📦 Block number:', receipt.blockNumber);

          // ✅ Validate that the approval actually worked
          console.log('🔍 Validating approval success...');
          
          const isApprovalValid = await validateApprovalSuccess(
            tokenAddress,
            ONEINCH_ROUTER,
            requiredAmount,
            approvalService
          );

          if (!isApprovalValid) {
            throw new Error('Approval validation failed - insufficient allowance after approval');
          }

          console.log('✅ Approval validation successful!');
          console.log('🎯 Token approved and validated successfully');

        } catch (confirmationError) {
  console.error('❌ Transaction confirmation failed:', confirmationError);
  const errorMessage = confirmationError instanceof Error 
    ? confirmationError.message 
    : 'Unknown confirmation error';
  throw new Error(`Approval confirmation failed: ${errorMessage}`);
}
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
      setApprovalTxHash(null);
      console.log('🏁 Permit and swap process completed');
    }
  };

  const handleConfirmSwap = async () => {
    console.log('🔄 Confirming swap...');
    console.log(`📊 Final swap: ${fromAmount} ${fromToken.symbol} → ${toAmount} ${toToken.symbol}`);
    
    try {
      setIsConfirmModalOpen(false);
      setIsSigningModalOpen(true);
      
      // ✅ Call appropriate backend endpoint based on swap direction
      let apiEndpoint = '';
      let swapData = {};
      
      if (fromToken.symbol === 'NEAR' || toToken.symbol === 'NEAR') {
        // Cross-chain swap involving NEAR
        if (fromToken.symbol === 'NEAR') {
          apiEndpoint = 'http://localhost:3001/near-to-polygon';
          swapData = {
            fromChain: 'near',
            toChain: 'polygon',
            fromToken: 'NEAR',
            toToken: toToken.symbol,
            fromAmount: ethers.parseUnits(fromAmount, 24).toString(), // NEAR uses 24 decimals
            toAmount: ethers.parseUnits(toAmount, TOKEN_CONFIG[toToken.symbol as keyof typeof TOKEN_CONFIG].decimals).toString(),
            maker: 'flexlock-swap.testnet',
            resolver: 'htlc.testnet'
          };
        } else {
          apiEndpoint = 'http://localhost:3001/polygon-to-near';
          swapData = {
            fromChain: 'polygon',
            toChain: 'near',
            fromToken: fromToken.symbol,
            toToken: 'NEAR',
            fromAmount: ethers.parseUnits(fromAmount, TOKEN_CONFIG[fromToken.symbol as keyof typeof TOKEN_CONFIG].decimals).toString(),
            toAmount: ethers.parseUnits(toAmount, 24).toString(), // NEAR uses 24 decimals
            maker: 'flexlock-swap.testnet',
            resolver: 'htlc.testnet'
          };
        }
        
        console.log('🌉 Executing cross-chain swap:', swapData);
        
        const swapResponse = await fetch(apiEndpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(swapData)
        });

        if (!swapResponse.ok) {
          throw new Error('Cross-chain swap execution failed');
        }

        const swapResult = await swapResponse.json();
        console.log('✅ Cross-chain swap completed:', swapResult);
        
      } else {
        // Regular ERC-20 to ERC-20 swap on Polygon
        console.log('🔄 Executing regular token swap on Polygon...');
        // Add your 1inch swap logic here
        await new Promise(resolve => setTimeout(resolve, 3000)); // Simulate swap
      }
      
      setIsSigningModalOpen(false);
      setIsCompletedModalOpen(true);
      
      // Auto close completion modal after 5 seconds
      setTimeout(() => {
        setIsCompletedModalOpen(false);
        console.log('✅ Swap process completed successfully');
      }, 5000);
      
    } catch (error) {
      console.error('❌ Swap execution failed:', error);
      setIsSigningModalOpen(false);
      alert(`Swap failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  };

  // Calculate USD values using real prices
  const fromUSDValue = calculateUSDValue(fromAmount, fromToken.symbol);
  const toUSDValue = calculateUSDValue(toAmount, toToken.symbol);
  const fromPrice = getTokenPrice(fromToken.symbol);
  const toPrice = getTokenPrice(toToken.symbol);

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
              <Button 
                variant="ghost" 
                size="icon" 
                className="text-muted-foreground hover:text-foreground"
                onClick={refetchPrices}
                disabled={pricesLoading}
              >
                <RefreshCw className={`h-4 w-4 ${pricesLoading ? 'animate-spin' : ''}`} />
              </Button>
              <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                <Shuffle className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Price error banner */}
          {priceError && (
            <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-3 mb-4">
              <p className="text-yellow-500 text-sm">
                ⚠️ Unable to fetch latest prices: {priceError}
              </p>
            </div>
          )}

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
                  {fromToken.name} {priceService.formatPrice(fromPrice)}
                </span>
                <span className="text-muted-foreground">
                  {pricesLoading ? 'Loading...' : `~$${fromUSDValue}`}
                </span>
              </div>
            </div>

            {/* Swap button */}
            <div className="flex justify-center">
              <Button
                variant="ghost"
                size="icon"
                onClick={handleSwapTokens}
                className="rounded-full bg-swap-input hover:bg-accent border border-border w-10 h-10"
                title="Swap tokens"
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
                    readOnly
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {toToken.name} {priceService.formatPrice(toPrice)}
                  </span>
                  <span className="text-muted-foreground">
                    {pricesLoading ? 'Loading...' : `~$${toUSDValue}`}
                  </span>
                </div>
              </div>
            </div>

            {/* Exchange rate */}
            <div className="text-sm text-muted-foreground">
              {parseFloat(fromPrice) > 0 && parseFloat(toPrice) > 0 ? (
                `1 ${fromToken.symbol} = ${(parseFloat(fromPrice) / parseFloat(toPrice)).toFixed(6)} ${toToken.symbol}`
              ) : (
                'Loading exchange rate...'
              )}
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
                  <span className="text-foreground">
                    {(parseFloat(toAmount) * 0.995).toFixed(6)} {toToken.symbol}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Network Fee</span>
                  <div className="flex items-center space-x-1">
                    <span className="text-primary text-xs">🔥 Free</span>
                    <span className="text-muted-foreground">~$0.10</span>
                  </div>
                </div>
              </div>
            )}

            {/* Network warning */}
            {isWalletConnected && chainId !== polygon.id && (
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
                disabled={isApproving || pricesLoading}
                className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 text-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isApproving 
                  ? (fromToken.symbol === 'NEAR' ? 'Processing NEAR Swap...' : 'Confirming Approval...')
                  : (fromToken.symbol === 'NEAR' || toToken.symbol === 'NEAR' ? 'Cross-Chain Swap' : 'Permit and swap')
                }
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
        onSelectToken={handleFromTokenSelect}
      />
      <TokenSelectModal
        isOpen={isToTokenModalOpen}
        onClose={() => setIsToTokenModalOpen(false)}
        onSelectToken={handleToTokenSelect}
      />

      {/* Transaction modals */}
      <TransactionModal
        isOpen={isSigningModalOpen}
        onClose={() => setIsSigningModalOpen(false)}
        title={
          isApproving 
            ? "Confirming Transaction..." 
            : "Processing Swap..."
        }
        description={
          isApproving 
            ? fromToken.symbol === 'NEAR' 
              ? `Initiating cross-chain swap from NEAR to ${toToken.symbol}. Please confirm the transaction in your wallet.`
              : `Waiting for approval transaction to be confirmed on blockchain. Transaction: ${approvalTxHash ? `${approvalTxHash.slice(0, 10)}...` : 'Pending'}`
            : `Executing swap from ${fromToken.symbol} to ${toToken.symbol}...`
        }
        showCloseButton={false}
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
          usdValue: `~$${fromUSDValue}`
        }}
        toToken={{
          symbol: toToken.symbol,
          name: toToken.name,
          icon: toToken.icon,
          amount: toAmount,
          usdValue: `~$${toUSDValue}`
        }}
      />

      <TransactionModal
        isOpen={isCompletedModalOpen}
        onClose={() => setIsCompletedModalOpen(false)}
        title="Swap Completed! 🎉"
        description={`Successfully swapped ${fromAmount} ${fromToken.symbol} for ${toAmount} ${toToken.symbol}`}
        showCloseButton={true}
      />
    </div>
  );
};
