import { JsonRpcProvider } from 'ethers';
import { ChainConfig } from './polygon/config';
import assert from 'node:assert';

export async function getProvider(
  cnf: ChainConfig,
): Promise<{ node?: any; provider: JsonRpcProvider }> {
  if (!cnf.createFork) {
    return {
      provider: new JsonRpcProvider(cnf.url, cnf.chainId, {
        cacheTimeout: -1,
        staticNetwork: true,
      }),
    };
  }

  // Dynamic import for ES modules with TypeScript bypass
  const prool = await eval('import("prool")');
  const proolInstances = await eval('import("prool/instances")');
  const { createServer } = prool;
  const { anvil } = proolInstances;

  const node = createServer({
    instance: anvil({ forkUrl: cnf.url, chainId: cnf.chainId }),
    limit: 1,
  });
  await node.start();

  const address = node.address();
  assert(address);

  const provider = new JsonRpcProvider(
    `http://[${address.address}]:${address.port}/1`,
    cnf.chainId,
    {
      cacheTimeout: -1,
      staticNetwork: true,
    },
  );

  return {
    provider,
    node,
  };
}
