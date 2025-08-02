#!/bin/bash

set -e

FACTORY_ACCOUNT="$1"
DEPLOYER_ACCOUNT="$2"

if [ -z "$FACTORY_ACCOUNT" ] || [ -z "$DEPLOYER_ACCOUNT" ]; then
    echo "Usage: ./deploy.sh <factory_account> <deployer_account>"
    echo "Example: ./deploy.sh htlc-factory.testnet alice.testnet"
    exit 1
fi

echo "🚀 Deploying HTLC Factory to $FACTORY_ACCOUNT..."

# Build contracts
./scripts/build_all.sh

echo ""
echo "📤 Deploying factory contract..."
near deploy --accountId $FACTORY_ACCOUNT --wasmFile escrow_factory/res/escrow_factory.wasm

echo ""
echo "🔧 Initializing factory..."
near call $FACTORY_ACCOUNT new '{}' --accountId $DEPLOYER_ACCOUNT

echo ""
echo "✅ Deployment complete!"
echo "🏭 Factory deployed at: $FACTORY_ACCOUNT"
echo ""
echo "📋 Next steps:"
echo "   1. Fund accounts that will use the factory"
echo "   2. Create cross-chain swaps using the factory"
echo "   3. Monitor escrow contracts created by the factory"

chmod +x scripts/deploy.sh
