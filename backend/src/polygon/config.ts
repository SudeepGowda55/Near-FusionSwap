import { NetworkEnum } from '@1inch/fusion-sdk';
import 'dotenv/config';

const fromEnv = {
  SRC_CHAIN_RPC: 'https://eth.merkle.io',
  SRC_CHAIN_CREATE_FORK: true,
  DST_CHAIN_RPC: 'wss://bsc-rpc.publicnode.com',
  DST_CHAIN_CREATE_FORK: true,
  POLYGON_CHAIN_RPC:
    'https://polygon-mainnet.g.alchemy.com/v2/wUelP0gIjMqLBYKKjGGvd8DvPC7UH8bw',
  POLYGON_CHAIN_CREATE_FORK: true,
  NEAR_CHAIN_RPC: 'https://near-testnet.api.pagoda.co/rpc/v1/',
  NEAR_CHAIN_CREATE_FORK: false,
};

export const config = {
  chain: {
    source: {
      chainId: NetworkEnum.ETHEREUM,
      url: fromEnv.SRC_CHAIN_RPC,
      createFork: fromEnv.SRC_CHAIN_CREATE_FORK,
      limitOrderProtocol: '0x111111125421ca6dc452d289314280a0f8842a65',
      wrappedNative: '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
      ownerPrivateKey:
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      tokens: {
        USDC: {
          address: '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48',
          donor: '0xd54F23BE482D9A58676590fCa79c8E43087f92fB',
        },
      },
    },
    destination: {
      chainId: NetworkEnum.BINANCE,
      url: fromEnv.DST_CHAIN_RPC,
      createFork: fromEnv.DST_CHAIN_CREATE_FORK,
      limitOrderProtocol: '0x111111125421ca6dc452d289314280a0f8842a65',
      wrappedNative: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
      ownerPrivateKey:
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      tokens: {
        USDC: {
          address: '0x8965349fb649a33a30cbfda057d8ec2c48abe2a2',
          donor: '0x4188663a85C92EEa35b5AD3AA5cA7CeB237C6fe9',
        },
      },
    },
    polygon: {
      chainId: NetworkEnum.POLYGON,
      url: fromEnv.POLYGON_CHAIN_RPC,
      createFork: fromEnv.POLYGON_CHAIN_CREATE_FORK,
      limitOrderProtocol: '0x111111125421ca6dc452d289314280a0f8842a65',
      wrappedNative: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
      ownerPrivateKey:
        process.env.POLYGON_RESOLVER_PRIVATE_KEY ||
        '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      tokens: {
        WETH: {
          address: '0x7ceb23fd6bc0add59e62ac25578270cff1b9f619',
          donor: '0x77ed0fef5e9DFB34e776adb11c29dd19d382745C',
        },
      },
    },
    near: {
      chainId: NetworkEnum.ETHEREUM,
      url: fromEnv.NEAR_CHAIN_RPC,
      createFork: fromEnv.NEAR_CHAIN_CREATE_FORK,
    },
  },
} as const;

export type ChainConfig = (typeof config.chain)[
  | 'source'
  | 'destination'
  | 'polygon'];
