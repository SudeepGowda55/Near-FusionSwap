#!/bin/bash

set -e

echo "🔨 Building HTLC cross-chain swap contracts..."

# Clean previous builds
cargo clean

# Build factory
echo "📦 Building escrow factory..."
cd escrow_factory
cargo build --target wasm32-unknown-unknown --release
mkdir -p res
cp target/wasm32-unknown-unknown/release/escrow_factory.wasm res/
echo "✅ Factory built: $(ls -lh res/escrow_factory.wasm | awk '{print $5}')"
cd ..

# Build source
echo "📦 Building escrow source..."
cd escrow_source  
cargo build --target wasm32-unknown-unknown --release
mkdir -p res
cp target/wasm32-unknown-unknown/release/escrow_source.wasm res/
echo "✅ Source built: $(ls -lh res/escrow_source.wasm | awk '{print $5}')"
cd ..

# Build destination
echo "📦 Building escrow destination..."
cd escrow_destination
cargo build --target wasm32-unknown-unknown --release
mkdir -p res
cp target/wasm32-unknown-unknown/release/escrow_destination.wasm res/
echo "✅ Destination built: $(ls -lh res/escrow_destination.wasm | awk '{print $5}')"
cd ..

echo "🎉 All contracts built successfully!"
echo ""
echo "📁 WASM files generated:"
echo "   - escrow_factory/res/escrow_factory.wasm"
echo "   - escrow_source/res/escrow_source.wasm" 
echo "   - escrow_destination/res/escrow_destination.wasm"
echo ""
echo "🚀 Ready for deployment!"

chmod +x scripts/build_all.sh
