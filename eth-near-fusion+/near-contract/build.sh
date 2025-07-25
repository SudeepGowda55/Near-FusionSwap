#!/bin/bash
set -e

# Build the contract
echo "Building NEAR contract..."
cargo build --target wasm32-unknown-unknown --release

# Copy the wasm file
cp target/wasm32-unknown-unknown/release/cross_chain_escrow.wasm ./res/

echo "Contract built successfully!"
echo "WASM file: ./res/cross_chain_escrow.wasm"

# Deploy to testnet (optional)
if [ "$1" = "--deploy" ]; then
    echo "Deploying to NEAR testnet..."
    near deploy --wasmFile ./res/cross_chain_escrow.wasm --accountId your-contract.testnet
fi
