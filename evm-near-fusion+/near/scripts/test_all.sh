#!/bin/bash

set -e

echo "🧪 Running HTLC test suite..."

# Build contracts first
echo "📦 Building contracts for testing..."
./scripts/build_all.sh

echo ""
echo "🔍 Running unit tests..."
cargo test --workspace --lib

echo ""
echo "🔍 Running integration tests..."
cargo test --test integration_tests -- --nocapture

echo ""
echo "✅ All tests passed! System is ready for deployment."

chmod +x scripts/test_all.sh
