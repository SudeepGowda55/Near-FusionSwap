"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronDown, ArrowUpDown, RefreshCw, Shuffle } from "lucide-react";
import { useState, useEffect } from "react";
import { TokenSelectModal } from "./TokenSelectModal";
import { TransactionModal } from "./TransactionModal";
import { TransactionSuccessModal } from "./TransactionSuccessModal";
import { ConfirmSwapModal } from "./ConfirmSwapModal";
import { CrossChainDetailsModal } from "./CrossChainDetailsModal";
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
    address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
    decimals: 18
  },
  USDC: {
    address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
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
  MATIC: {
    address: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270",
    decimals: 18
  }
};

// 1inch Router V5 contract address on Polygon
const ONEINCH_ROUTER = "0x111111125421ca6dc452d289314280a0f8842a65";

// Predefined WETH amounts for dropdown
const WETH_AMOUNTS = [
  { value: "0.000001", label: "0.000001 WETH" },
  { value: "0.000002", label: "0.000002 WETH" }
];

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

interface CrossChainDetails {
  privateKey: string;
  receiverAddress: string;
  nearAccountId: string;
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
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false);
  const [transactionDetails, setTransactionDetails] = useState<{
    txHash?: string;
    polygonTxHash?: string;
    nearTxHash?: string;
  }>({});
  const [isCrossChainModalOpen, setIsCrossChainModalOpen] = useState(false);
  const [isApproving, setIsApproving] = useState(false);
  const [isCrossChainProcessing, setIsCrossChainProcessing] = useState(false);

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
        // Round to 6 decimal places for display
        setToAmount((Math.round(calculatedToAmount * 1000000) / 1000000).toString());
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

  // Check if this is a cross-chain swap
  const isCrossChainSwap = () => {
    return (fromToken.symbol === 'NEAR' && toToken.symbol === 'WETH') ||
           (fromToken.symbol === 'WETH' && toToken.symbol === 'NEAR');
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
      console.log(`  Is Cross-chain: ${isCrossChainSwap()}`);
      
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
        console.log('🌈 NEAR token detected - this should not happen on Polygon network');
        console.log('⚠️ NEAR is not available on Polygon network');
        
        setIsSigningModalOpen(false);
        setIsApproving(false);
        alert('NEAR token is not available on Polygon network. Please select a different token.');
        return;
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
        
        // Check if this is a cross-chain swap
        if (isCrossChainSwap()) {
          console.log('🌉 Cross-chain swap detected, opening cross-chain details modal');
          setIsCrossChainModalOpen(true);
        } else {
          setIsConfirmModalOpen(true);
        }
        
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
      
      console.log('🔄 Moving to next step...');
      
      // Close signing modal
      setIsSigningModalOpen(false);
      
      // Check if this is a cross-chain swap and show appropriate modal
      if (isCrossChainSwap()) {
        console.log('🌉 Cross-chain swap detected, opening cross-chain details modal');
        setIsCrossChainModalOpen(true);
      } else {
        console.log('🔄 Regular swap, moving to confirmation');
        setIsConfirmModalOpen(true);
      }

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

  const handlePolygonToNearSwap = async (details: CrossChainDetails) => {
    try {
      console.log('🌉 Initiating Polygon to NEAR swap...');
      
      // Determine private key to use - keep as is for test account, use provided if user enters one
      const privateKeyToUse = details.privateKey || "0x086d9b31deffa04692b629d84961c7281c8dac3f7be1742b3964ffc58a75c10e";
      
      // Determine NEAR account ID to use - keep default if user doesn't specify
      const nearAccountIdToUse = details.nearAccountId || "goldrogerswap.testnet";
      
      // Get NEAR price to calculate taking amount based on user input
      const nearPrice = getTokenPrice('NEAR');
      const wethPrice = getTokenPrice('WETH');
      
      let calculatedTakingAmount = 0.001; // Default fallback
      
      // Calculate taking amount based on current prices and user's making amount
      if (parseFloat(nearPrice) > 0 && parseFloat(wethPrice) > 0 && fromAmount) {
        const makingAmountUSD = parseFloat(fromAmount) * parseFloat(wethPrice);
        calculatedTakingAmount = makingAmountUSD / parseFloat(nearPrice);
        
        // Round to 6 decimal places to avoid precision issues with ethers.js
        calculatedTakingAmount = Math.round(calculatedTakingAmount * 1000000) / 1000000;
        
        console.log('💰 Price calculation:');
        console.log(`  - WETH price: $${wethPrice}`);
        console.log(`  - NEAR price: $${nearPrice}`);
        console.log(`  - Making amount: ${fromAmount} WETH`);
        console.log(`  - USD value: $${makingAmountUSD}`);
        console.log(`  - Calculated taking amount (raw): ${makingAmountUSD / parseFloat(nearPrice)} NEAR`);
        console.log(`  - Calculated taking amount (rounded): ${calculatedTakingAmount} NEAR`);
      }
      
      const requestPayload = {
        makerPk: privateKeyToUse,
        srcChainId: 137, // Polygon chain ID - remains as is
        makerAssetAddress: "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619", // WETH on Polygon - remains as is
        takerAssetAddress: "0x0000000000000000000000000000000000000000", // ETH address format - remains as is
        makingAmount: Math.round(parseFloat(fromAmount) * 1000000) / 1000000, // Round to 6 decimal places
        takingAmount: calculatedTakingAmount, // Already rounded above
        makerNearAccountId: nearAccountIdToUse // Keep default or apply provided account ID
      };
      
      // Validate the payload before sending
      if (requestPayload.makingAmount <= 0) {
        throw new Error('Making amount must be greater than 0');
      }
      if (requestPayload.takingAmount <= 0) {
        throw new Error('Taking amount must be greater than 0');
      }
      if (requestPayload.makingAmount > 1000) {
        console.warn('⚠️ Large making amount detected:', requestPayload.makingAmount);
      }
      
      console.log('📡 Sending request to polygon-to-near endpoint:');
      console.log('🔧 Request payload:', {
        ...requestPayload,
        makerPk: '***REDACTED***' // Don't log private key for security
      });
      
      // Use Next.js API route to avoid CORS issues
      const apiUrl = '/api/polygon-to-near';
      
      console.log('🌐 API URL:', apiUrl);
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ HTTP Error Response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, message: ${errorText}`);
      }
      
      const responseData = await response.json();
      console.log('✅ Polygon to NEAR swap response:', responseData);
      console.log('📊 Response details:', JSON.stringify(responseData, null, 2));
      
      // Return success to indicate the swap was completed
      return { success: true, data: responseData };
      
    } catch (error) {
      console.error('❌ Polygon to NEAR swap failed:', error);
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.error('🚨 Error details:', errorMessage);
      
      // Check if it's a network error
      if (errorMessage.includes('Failed to fetch')) {
        console.error('🌐 Network Error detected - Check if backend is running');
        alert(`Network Error: Unable to connect to the backend server.\n\nPlease ensure the backend is running on port 3001.\n\nError: ${errorMessage}`);
      } else {
        alert(`Cross-chain swap failed: ${errorMessage}`);
      }
      
      // Return failure
      return { success: false, error: errorMessage };
    }
  };

  const handleCrossChainDetailsSubmit = async (details: CrossChainDetails) => {
    console.log('🌉 Cross-chain details submitted:');
    console.log('📝 Cross-chain swap details:', {
      direction: `${fromToken.symbol} → ${toToken.symbol}`,
      privateKey: '***REDACTED***', // Don't log actual private key for security
      receiverAddress: details.receiverAddress,
      nearAccountId: details.nearAccountId,
      isNearToEvm: fromToken.symbol === 'NEAR',
      isEvmToNear: toToken.symbol === 'NEAR'
    });
    
    // Log the actual details to console (be careful in production)
    console.log('🔐 Private Key:', details.privateKey);
    console.log('📬 Receiver Address:', details.receiverAddress);
    console.log('🌈 NEAR Account ID:', details.nearAccountId);
    
    // If this is a polygon-to-near swap, call the backend endpoint
    if (fromToken.symbol === 'WETH' && toToken.symbol === 'NEAR') {
      setIsCrossChainProcessing(true);
      console.log('🔄 Calling polygon-to-near swap API...');
      
      try {
        const result = await handlePolygonToNearSwap(details);
        
        if (result.success) {
          console.log('✅ Polygon to NEAR swap completed successfully');
          console.log('📊 Transaction result:', result);
          
          // Store transaction details
          setTransactionDetails({
            polygonTxHash: result.data?.txHash,
            nearTxHash: result.data?.blockHash // or another hash if available
          });
          
          // Close cross-chain modal and show success modal
          setIsCrossChainModalOpen(false);
          setIsCrossChainProcessing(false);
          setIsSuccessModalOpen(true);
          
          // Reset form state since transaction completed
          setTimeout(() => {
            // Small delay to ensure modal state is properly updated
          }, 100);
          
          // Don't proceed to confirmation modal for cross-chain swaps
          return;
        } else {
          console.error('❌ Polygon to NEAR swap failed, keeping modal open');
          setIsCrossChainProcessing(false);
          // Keep the cross-chain modal open so user can retry
          return;
        }
      } catch (error) {
        console.error('❌ Error in cross-chain swap process:', error);
        setIsCrossChainProcessing(false);
        // Keep modal open for retry
        return;
      }
    }
    
    // For other types of cross-chain swaps, proceed normally
    setIsCrossChainModalOpen(false);
    setIsConfirmModalOpen(true);
  };

  const handleConfirmSwap = () => {
    console.log('🔄 Confirming swap...');
    console.log(`📊 Final swap: ${fromAmount} ${fromToken.symbol} → ${toAmount} ${toToken.symbol}`);
    setIsConfirmModalOpen(false);
    setIsCompletedModalOpen(true);
    
    // Auto close completion modal after 3 seconds
    setTimeout(() => {
      setIsCompletedModalOpen(false);
      console.log('✅ Swap process completed successfully');
    }, 3000);
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

          {/* Cross-chain swap indicator */}
          {isCrossChainSwap() && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-4">
              <p className="text-blue-500 text-sm flex items-center">
                <span className="mr-2">🌉</span>
                Cross-chain swap detected: {fromToken.symbol} → {toToken.symbol}
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
                {/* Conditional input based on token type */}
                {fromToken.symbol === 'WETH' && toToken.symbol === 'NEAR' ? (
                  <Select value={fromAmount} onValueChange={setFromAmount}>
                    <SelectTrigger className="text-right text-2xl font-semibold bg-transparent border-none p-0 h-auto text-foreground w-auto">
                      <SelectValue placeholder="Select amount" />
                    </SelectTrigger>
                    <SelectContent>
                      {WETH_AMOUNTS.map((amount) => (
                        <SelectItem key={amount.value} value={amount.value}>
                          {amount.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={fromAmount}
                    onChange={(e) => setFromAmount(e.target.value)}
                    className="text-right text-2xl font-semibold bg-transparent border-none p-0 h-auto text-foreground"
                    placeholder="0"
                  />
                )}
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
                    <span className="text-muted-foreground">~$0.0</span>
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
                  ? 'Approving Token...'
                  : isCrossChainSwap() 
                    ? `Cross-chain Swap ${fromToken.symbol} → ${toToken.symbol}`
                    : 'Permit and swap'
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

      {/* Cross-chain details modal */}
      <CrossChainDetailsModal
        isOpen={isCrossChainModalOpen}
        onClose={() => setIsCrossChainModalOpen(false)}
        onSubmit={handleCrossChainDetailsSubmit}
        fromToken={fromToken.symbol}
        toToken={toToken.symbol}
        isProcessing={isCrossChainProcessing}
      />

      {/* Transaction modals */}
      <TransactionModal
        isOpen={isSigningModalOpen}
        onClose={() => setIsSigningModalOpen(false)}
        title={isApproving ? "Approving Token Access..." : "Please sign the transaction in your wallet"}
        description={
          isApproving 
            ? `Please confirm the ${fromToken.symbol} approval transaction in your wallet to allow 1inch Router to spend your tokens.`
            : ""
        }
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
        title="Cross-chain swap completed"
        description="Your WETH to NEAR cross-chain swap has been successfully processed"
        showCloseButton={false}
      />

      <TransactionSuccessModal
        isOpen={isSuccessModalOpen}
        onClose={() => {
          setIsSuccessModalOpen(false);
          // Reset transaction details
          setTransactionDetails({});
        }}
        polygonTxHash={transactionDetails.polygonTxHash}
        nearTxHash={transactionDetails.nearTxHash}
      />
    </div>
  );
};
