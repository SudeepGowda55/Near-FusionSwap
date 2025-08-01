import { ethers } from 'ethers';

// ABI for ERC20 functions
const ERC20_ABI = [
  "function approve(address spender, uint256 amount) external returns (bool)",
  "function allowance(address owner, address spender) external view returns (uint256)",
  "function balanceOf(address account) external view returns (uint256)",
  "function decimals() external view returns (uint8)",
  "function symbol() external view returns (string)",
  "function name() external view returns (string)"
];

export interface TokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  balance: bigint;
}

export interface ApprovalResult {
  success: boolean;
  transactionHash?: string;
  error?: string;
}

// Network validation helper
const verifyNetwork = async (provider: ethers.Provider): Promise<boolean> => {
  try {
    const network = await provider.getNetwork();
    console.log('🌐 Current network:', {
      chainId: network.chainId,
      name: network.name
    });
    
    // Polygon chainId is 137
    return network.chainId === BigInt(137); // ✅ Fixed
  } catch (error) {
    console.error('Failed to get network:', error);
    return false;
  }
};

export class TokenApprovalService {
  private signer: ethers.Signer;
  private provider: ethers.Provider;

  constructor(signer: ethers.Signer) {
    this.signer = signer;
    this.provider = signer.provider!;
  }

  /**
   * Approve token spending using contract method
   */
  public async approveToken(
    tokenAddress: string, 
    spenderAddress: string, 
    amount: bigint = ethers.MaxUint256
  ): Promise<ApprovalResult> {
    try {
      console.log(`🔐 Approving token ${tokenAddress} for spender ${spenderAddress}`);
      
      // Validate addresses
      if (!ethers.isAddress(tokenAddress) || !ethers.isAddress(spenderAddress)) {
        throw new Error('Invalid token or spender address');
      }

      // Verify network
      const isPolygon = await verifyNetwork(this.provider);
      if (!isPolygon) {
        throw new Error('Please switch to Polygon network');
      }

      // Create contract instance
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.signer);
      
      // Verify the contract is a valid ERC20 token
      try {
        const symbol = await tokenContract.symbol();
        console.log('✅ Token contract verified:', symbol);
      } catch (error) {
        console.error('❌ Invalid token contract or wrong network');
        throw new Error(`Invalid token contract: ${tokenAddress}. Please check if you're on the correct network.`);
      }
      
      // Check if we need to reset approval first (for some tokens like USDT)
      let currentAllowance: bigint;
      try {
        currentAllowance = await this.getCurrentAllowance(tokenAddress, spenderAddress);
      } catch (error) {
        console.warn('⚠️ Could not check current allowance, proceeding with approval');
        currentAllowance = BigInt(0);
      }
      
      if (currentAllowance > BigInt(0) && amount !== currentAllowance) {
        console.log('🔄 Resetting approval to 0 first...');
        const resetTx = await tokenContract.approve(spenderAddress, BigInt(0));
        await resetTx.wait();
        console.log('✅ Reset approval successful:', resetTx.hash);
      }
      
      // Send approve transaction
      console.log('📝 Sending approval transaction...');
      const tx = await tokenContract.approve(spenderAddress, amount);
      console.log('📤 Approval transaction sent:', tx.hash);
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      console.log('✅ Token approval successful:', tx.hash);
      
      return {
        success: true,
        transactionHash: tx.hash
      };
    } catch (error) {
      console.error('❌ Token approval failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Alternative implementation using raw transaction (matching your reference)
   */
  public async approveTokenRaw(
    tokenAddress: string, 
    spenderAddress: string, 
    amount: bigint = ethers.MaxUint256
  ): Promise<ApprovalResult> {
    try {
      console.log(`🔐 Raw approving token ${tokenAddress} for spender ${spenderAddress}`);
      
      // Validate addresses
      if (!ethers.isAddress(tokenAddress) || !ethers.isAddress(spenderAddress)) {
        throw new Error('Invalid token or spender address');
      }

      // Verify network
      const isPolygon = await verifyNetwork(this.provider);
      if (!isPolygon) {
        throw new Error('Please switch to Polygon network');
      }

      // Encode the approve function call
      const abiCoder = new ethers.AbiCoder();
      const data = '0x095ea7b3' + abiCoder.encode(['address', 'uint256'], [spenderAddress, amount]).slice(2);

      // Estimate gas for the transaction
      const gasEstimate = await this.provider.estimateGas({
        to: tokenAddress,
        data: data
      });

      // Send raw transaction with gas buffer (120% of estimate)
      const gasWithBuffer = (gasEstimate * BigInt(120)) / BigInt(100);
      const tx = await this.signer.sendTransaction({
        to: tokenAddress,
        data: data,
        gasLimit: gasWithBuffer
      });

      console.log('📤 Raw approval transaction sent:', tx.hash);
      
      // Wait for transaction confirmation
      const receipt = await tx.wait();
      console.log('✅ Raw token approval successful:', tx.hash);
      
      return {
        success: true,
        transactionHash: tx.hash
      };
    } catch (error) {
      console.error('❌ Raw token approval failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  /**
   * Check current allowance for a token
   */
  public async getCurrentAllowance(
    tokenAddress: string, 
    spenderAddress: string
  ): Promise<bigint> {
    try {
      const ownerAddress = await this.signer.getAddress();
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
      
      console.log('🔍 Checking allowance for:');
      console.log('  - Owner:', ownerAddress);
      console.log('  - Token:', tokenAddress);
      console.log('  - Spender:', spenderAddress);
      
      // First verify the contract exists and is an ERC20 token
      try {
        await tokenContract.symbol();
        console.log('✅ Token contract verified for allowance check');
      } catch (error) {
        console.error('❌ Invalid token contract or wrong network');
        throw new Error(`Invalid token contract: ${tokenAddress}. Please check if you're on the correct network.`);
      }
      
      const allowance = await tokenContract.allowance(ownerAddress, spenderAddress);
      console.log('✅ Current allowance retrieved:', ethers.formatEther(allowance));
      return allowance;
    } catch (error) {
      console.error('❌ Failed to get current allowance:', error);
      
      // Check if it's a network/contract issue
      if (error instanceof Error && error.message.includes('could not decode result data')) {
        throw new Error('Network mismatch or invalid token contract. Please ensure you are connected to Polygon network.');
      }
      
      return BigInt(0);
    }
  }

  /**
   * Check if approval is needed
   */
  public async isApprovalNeeded(
    tokenAddress: string, 
    spenderAddress: string, 
    requiredAmount: bigint
  ): Promise<boolean> {
    try {
      const currentAllowance = await this.getCurrentAllowance(tokenAddress, spenderAddress);
      return currentAllowance < requiredAmount;
    } catch (error) {
      console.error('Failed to check if approval is needed:', error);
      return true; // Assume approval is needed on error
    }
  }

  /**
   * Get token information
   */
  public async getTokenInfo(tokenAddress: string): Promise<TokenInfo | null> {
    try {
      const tokenContract = new ethers.Contract(tokenAddress, ERC20_ABI, this.provider);
      const userAddress = await this.signer.getAddress();
      
      const [name, symbol, decimals, balance] = await Promise.all([
        tokenContract.name(),
        tokenContract.symbol(),
        tokenContract.decimals(),
        tokenContract.balanceOf(userAddress)
      ]);

      return {
        address: tokenAddress,
        name,
        symbol,
        decimals,
        balance
      };
    } catch (error) {
      console.error('Failed to get token info:', error);
      return null;
    }
  }

  /**
   * Format token amount for display
   */
  public static formatTokenAmount(amount: bigint, decimals: number): string {
    return ethers.formatUnits(amount, decimals);
  }

  /**
   * Parse token amount from user input
   */
  public static parseTokenAmount(amount: string, decimals: number): bigint {
    return ethers.parseUnits(amount, decimals);
  }

  /**
   * Check if user has sufficient balance
   */
  public async hasInsufficientBalance(
    tokenAddress: string, 
    requiredAmount: bigint
  ): Promise<boolean> {
    try {
      const tokenInfo = await this.getTokenInfo(tokenAddress);
      if (!tokenInfo) return true;
      
      return tokenInfo.balance < requiredAmount;
    } catch (error) {
      console.error('Failed to check balance:', error);
      return true; // Assume insufficient balance on error
    }
  }
}

// Export utility functions
export const createTokenApprovalService = (signer: ethers.Signer): TokenApprovalService => {
  return new TokenApprovalService(signer);
};

// Common token addresses
export const COMMON_TOKENS = {
  POLYGON: {
    WETH: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619",
    USDC: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174",
    USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
    DAI: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063",
  },
  ETHEREUM: {
    WETH: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
    USDC: "0xA0b86a33E6441e4e6e40b4d4e7F9e1F6e5e5e5e5",
    USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
    DAI: "0x6B175474E89094C44Da98b954EedeAC495271d0F",
  }
};

// 1inch Router addresses
export const ROUTER_ADDRESSES = {
  POLYGON: "0x111111125421ca6dc452d289314280a0f8842a65",
  ETHEREUM: "0x111111125421ca6dc452d289314280a0f8842a65",
};
