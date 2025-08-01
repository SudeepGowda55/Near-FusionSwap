// Updated token addresses including NEAR
export const PRICE_TOKEN_ADDRESSES = {
    POLYGON: {
      WETH: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", // Wrapped ETH
      USDC: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", // USDC (old - more likely to work)
      USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", // Tether
      DAI: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",   // DAI
      MATIC: "0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270", // Wrapped MATIC
      NEAR: "0x85f17cf997934a597031b2e18a9ab6ebd4b9f6a4",   // NEAR on Polygon (bridged)
    },
    ETHEREUM: {
      WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
      USDC: "0xA0b86a33E6441e4e6e40b4d4e7F9e1F6e5e5e5e5",
      USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
      DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
      NEAR: "0x85f17cf997934a597031b2e18a9ab6ebd4b9f6a4",   // NEAR on Ethereum (bridged)
    }
  };
  
  export interface TokenPrice {
    [tokenAddress: string]: string;
  }
  
  export class PriceService {
    private baseUrl = '/api/prices';
    private cache = new Map<string, { price: string; timestamp: number }>();
    private cacheTimeout = 300000; // 5 minutes cache
    private lastRequestTime = 0;
    private requestCooldown = 10000; // 10 seconds between requests
    private isRequesting = false;
  
    async getTokenPrices(
      chainId: number,
      tokenAddresses: string[],
      currency: string = 'USD'
    ): Promise<TokenPrice> {
      try {
        console.log('💰 Fetching token prices for chainId:', chainId);
        console.log('📋 Token addresses:', tokenAddresses);
  
        if (this.isRequesting) {
          console.log('⏳ Request already in progress, using cache/fallback...');
          return this.getCachedOrFallbackPrices(tokenAddresses, chainId, currency);
        }
  
        const now = Date.now();
        if (now - this.lastRequestTime < this.requestCooldown) {
          console.log('🚫 Rate limit: Too soon since last request, using cache/fallback...');
          return this.getCachedOrFallbackPrices(tokenAddresses, chainId, currency);
        }
  
        // Check cache first
        const cachedPrices: TokenPrice = {};
        const addressesToFetch: string[] = [];
  
        for (const address of tokenAddresses) {
          const cacheKey = `${chainId}-${address}-${currency}`;
          const cached = this.cache.get(cacheKey);
          
          if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
            cachedPrices[address] = cached.price;
            console.log(`💾 Using cached price for ${address}: $${cached.price}`);
          } else {
            addressesToFetch.push(address);
          }
        }
  
        if (addressesToFetch.length === 0) {
          console.log('✅ All prices served from cache');
          return cachedPrices;
        }
  
        this.isRequesting = true;
        this.lastRequestTime = now;
  
        const params = new URLSearchParams({
          chainId: chainId.toString(),
          currency,
          tokens: addressesToFetch.join(',')
        });
  
        const url = `${this.baseUrl}?${params.toString()}`;
        console.log('🌐 API Request URL:', url);
  
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000);
  
        const response = await fetch(url, {
          method: 'GET',
          headers: {
            'Accept': 'application/json',
            'Content-Type': 'application/json',
          },
          cache: 'no-store',
          signal: controller.signal
        });
  
        clearTimeout(timeoutId);
  
        if (!response.ok) {
          console.warn(`⚠️ API error: ${response.status}, using fallback prices`);
          return { ...cachedPrices, ...this.getFallbackPrices(addressesToFetch) };
        }
  
        const data: TokenPrice = await response.json();
        console.log('✅ Price API response:', data);
  
        // Check if we got prices for our requested addresses
        const finalPrices: TokenPrice = { ...cachedPrices };
        
        for (const address of addressesToFetch) {
          if (data[address]) {
            finalPrices[address] = data[address];
            // Cache the price
            const cacheKey = `${chainId}-${address}-${currency}`;
            this.cache.set(cacheKey, { price: data[address], timestamp: Date.now() });
            console.log(`✅ Got price for ${address}: $${data[address]}`);
          } else {
            // Use fallback price if not found in response
            const fallbackPrice = this.getFallbackPrices([address])[address];
            finalPrices[address] = fallbackPrice;
            console.log(`🔄 Using fallback price for ${address}: $${fallbackPrice}`);
          }
        }
  
        return finalPrices;
  
      } catch (error) {
        console.error('❌ Error fetching token prices:', error);
        return this.getCachedOrFallbackPrices(tokenAddresses, chainId, currency);
      } finally {
        this.isRequesting = false;
      }
    }
  
    private getCachedOrFallbackPrices(tokenAddresses: string[], chainId: number, currency: string): TokenPrice {
      const result: TokenPrice = {};
      
      for (const address of tokenAddresses) {
        const cacheKey = `${chainId}-${address}-${currency}`;
        const cached = this.cache.get(cacheKey);
        
        if (cached) {
          result[address] = cached.price;
          console.log(`💾 Using cached price for ${address}: $${cached.price}`);
        } else {
          const fallbackPrice = this.getFallbackPrices([address])[address];
          result[address] = fallbackPrice;
          console.log(`🔄 Using fallback price for ${address}: $${fallbackPrice}`);
        }
      }
      
      return result;
    }
  
    private getFallbackPrices(tokenAddresses: string[]): TokenPrice {
      const fallbackPrices: TokenPrice = {};
      
      // Updated with current market prices including NEAR
      const fallbackMap: { [key: string]: string } = {
        '0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619': '3800.00', // WETH
        '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174': '1.00',   // USDC (old)
        '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359': '1.00',   // USDC (new)
        '0xc2132D05D31c914a87C6611C10748AEb04B58e8F': '1.00',   // USDT
        '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063': '1.00',   // DAI
        '0x0d500b1d8e8ef31e21c99d1db9a6444d3adf1270': '0.20',   // MATIC/WMATIC
        '0x85f17cf997934a597031b2e18a9ab6ebd4b9f6a4': '2.70',   // NEAR (current market price)
      };
      
      tokenAddresses.forEach(address => {
        fallbackPrices[address] = fallbackMap[address] || '1.00';
      });
      
      console.log('🔄 Using fallback prices:', fallbackPrices);
      return fallbackPrices;
    }
  
    async getSingleTokenPrice(
      chainId: number,
      tokenAddress: string,
      currency: string = 'USD'
    ): Promise<string> {
      const prices = await this.getTokenPrices(chainId, [tokenAddress], currency);
      return prices[tokenAddress] || '1.00';
    }
  
    calculateUSDValue(amount: string, pricePerToken: string, decimals: number = 18): string {
      try {
        const amountFloat = parseFloat(amount);
        const priceFloat = parseFloat(pricePerToken);
        
        if (isNaN(amountFloat) || isNaN(priceFloat)) {
          return '0.00';
        }
  
        const usdValue = amountFloat * priceFloat;
        return usdValue.toFixed(2);
      } catch (error) {
        console.error('Error calculating USD value:', error);
        return '0.00';
      }
    }
  
    formatPrice(price: string): string {
      const priceFloat = parseFloat(price);
      if (priceFloat === 0) return '$0.00';
      if (priceFloat < 0.01) return '<$0.01';
      if (priceFloat < 1) return `$${priceFloat.toFixed(4)}`;
      return `$${priceFloat.toFixed(2)}`;
    }
  
    clearCache(): void {
      this.cache.clear();
      console.log('🗑️ Price cache cleared');
    }
  
    getNetworkName(chainId: number): string {
      switch (chainId) {
        case 1: return 'Ethereum';
        case 137: return 'Polygon';
        default: return `Chain ${chainId}`;
      }
    }
  }
  
  export const priceService = new PriceService();
  