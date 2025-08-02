import { useState, useEffect, useCallback, useRef } from 'react';
import { useChainId } from 'wagmi';
import { priceService, TokenPrice, PRICE_TOKEN_ADDRESSES } from '@/utils/priceService';

export interface UseTokenPricesResult {
  prices: TokenPrice;
  loading: boolean;
  error: string | null;
  refetch: () => void;
  getTokenPrice: (tokenSymbol: string) => string;
  calculateUSDValue: (amount: string, tokenSymbol: string) => string;
}

export const useTokenPrices = (tokenSymbols: string[] = []): UseTokenPricesResult => {
  const [prices, setPrices] = useState<TokenPrice>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chainId = useChainId();
  const lastFetchRef = useRef<number>(0);
  const fetchTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Fixed: Added initial value

  const getTokenAddresses = useCallback((symbols: string[]): string[] => {
    const networkTokens = chainId === 137 ? PRICE_TOKEN_ADDRESSES.POLYGON : PRICE_TOKEN_ADDRESSES.ETHEREUM;
    
    return symbols
      .map(symbol => {
        const address = networkTokens[symbol as keyof typeof networkTokens];
        if (!address) {
          console.warn(`⚠️ Token ${symbol} not found in network ${chainId}`);
        }
        return address;
      })
      .filter(Boolean);
  }, [chainId]);

  const fetchPrices = useCallback(async (force: boolean = false) => {
    if (tokenSymbols.length === 0) return;

    // Prevent too frequent requests
    const now = Date.now();
    if (!force && now - lastFetchRef.current < 10000) { // 10 seconds minimum between auto-fetches
      console.log('⏳ Skipping fetch - too soon since last request');
      return;
    }

    setLoading(true);
    setError(null);
    lastFetchRef.current = now;

    try {
      const addresses = getTokenAddresses(tokenSymbols);
      if (addresses.length === 0) {
        throw new Error('No valid token addresses found');
      }

      console.log('🔄 Fetching prices for tokens:', tokenSymbols);
      console.log('🌐 Network:', priceService.getNetworkName(chainId));
      
      const fetchedPrices = await priceService.getTokenPrices(chainId, addresses);
      setPrices(fetchedPrices);
      
      console.log('💰 Updated token prices:', fetchedPrices);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch prices';
      setError(errorMessage);
      console.error('❌ Price fetch error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [chainId, tokenSymbols, getTokenAddresses]);

  // Initial fetch and setup interval
  useEffect(() => {
    // Clear any existing timeout
    if (fetchTimeoutRef.current) {
      clearTimeout(fetchTimeoutRef.current);
    }

    // Initial fetch
    fetchPrices(false);
    
    // Set up interval to refresh prices every 2 minutes (increased from 30 seconds)
    const interval = setInterval(() => {
      fetchPrices(false);
    }, 120000); // 2 minutes
    
    return () => {
      clearInterval(interval);
      if (fetchTimeoutRef.current) {
        clearTimeout(fetchTimeoutRef.current);
      }
    };
  }, [fetchPrices]);

  const getTokenPrice = useCallback((tokenSymbol: string): string => {
    const networkTokens = chainId === 137 ? PRICE_TOKEN_ADDRESSES.POLYGON : PRICE_TOKEN_ADDRESSES.ETHEREUM;
    const address = networkTokens[tokenSymbol as keyof typeof networkTokens];
    
    if (!address) {
      console.warn(`⚠️ Token ${tokenSymbol} not supported on network ${chainId}`);
      return '0.00';
    }
    
    const price = prices[address] || '0.00';
    console.log(`💰 Price for ${tokenSymbol} (${address}): $${price}`);
    return price;
  }, [prices, chainId]);

  const calculateUSDValue = useCallback((amount: string, tokenSymbol: string): string => {
    const price = getTokenPrice(tokenSymbol);
    return priceService.calculateUSDValue(amount, price);
  }, [getTokenPrice]);

  const manualRefetch = useCallback(() => {
    fetchPrices(true); // Force fetch
  }, [fetchPrices]);

  return {
    prices,
    loading,
    error,
    refetch: manualRefetch,
    getTokenPrice,
    calculateUSDValue
  };
};
