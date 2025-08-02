import { JsonRpcProvider } from 'ethers';

export type Chain = {
  node?: any | undefined;
  provider: JsonRpcProvider;
  escrowFactory: string;
  resolver: string;
};
