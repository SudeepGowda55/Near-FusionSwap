# Ethereum ↔ NEAR Cross-Chain Swap Integration Plan

## Architecture Overview

```
Ethereum Side:                    NEAR Side:
┌─────────────────┐              ┌─────────────────┐
│ Limit Order     │              │ Escrow Contract │
│ Protocol        │              │ (NEAR)          │
├─────────────────┤              ├─────────────────┤
│ Escrow Factory  │              │ Token Handler   │
├─────────────────┤              ├─────────────────┤
│ Resolver        │◄────────────►│ Cross-chain     │
│ (Smart Contract)│              │ Message Handler │
└─────────────────┘              └─────────────────┘
         ▲                                ▲
         │                                │
    ┌─────────────────────────────────────────────┐
    │        TypeScript Resolver Service          │
    │    (Orchestrates cross-chain operations)    │
    └─────────────────────────────────────────────┘
```

## Required Components

### 1. NEAR Smart Contracts

#### A. Escrow Contract (`escrow.near`)

```rust
// Key functions needed:
- create_escrow(order_hash, amount, token, recipient, timelock)
- deposit_tokens(escrow_id, amount)
- withdraw_with_secret(escrow_id, secret)
- cancel_escrow(escrow_id)
- emergency_withdraw(escrow_id) // after timelock
```

#### B. Cross-chain Message Handler

```rust
// Functions needed:
- verify_ethereum_proof(block_header, tx_proof, receipt_proof)
- process_ethereum_deposit(proof_data)
- emit_withdrawal_event(order_hash, recipient, amount)
```

### 2. Token Support

#### On NEAR:

- **Native NEAR tokens** (NEAR, wNEAR)
- **Bridged tokens** (ETH.near, USDC.near from Rainbow Bridge)
- **Custom tokens** deployed on NEAR

#### Bridge Options:

1. **Rainbow Bridge** (Ethereum ↔ NEAR bridge)
2. **Custom messaging** for faster finality
3. **Layer 2 solutions** (optional)

### 3. TypeScript Resolver Service

Key responsibilities:

- Monitor Ethereum events
- Submit transactions to NEAR
- Handle secret sharing
- Manage timeouts and cancellations
- Coordinate bidirectional swaps

## Implementation Steps

### Phase 1: Basic ETH → NEAR Swap

1. Deploy NEAR escrow contract
2. Integrate Rainbow Bridge for token transfers
3. Create NEAR resolver functions
4. Test unidirectional swaps

### Phase 2: Bidirectional Swaps

1. Add NEAR → ETH functionality
2. Implement proper event monitoring
3. Add retry and error handling
4. Optimize gas costs

### Phase 3: Production Features

1. Add multiple token support
2. Implement fee collection
3. Add monitoring/alerting
4. Security audits

## Technical Considerations

### Security:

- Hash timelock contracts (HTLC)
- Proper timeout handling
- Secret revelation mechanisms
- Emergency recovery procedures

### Performance:

- NEAR finality (~2-3 seconds)
- Ethereum finality (~12-15 minutes for safety)
- Gas optimization on both chains

### User Experience:

- Clear swap status updates
- Estimated completion times
- Failure recovery options

################## NEAR SETUP GUIDE ##################

# Ethereum ↔ NEAR Cross-Chain Swap Setup Guide

## Quick Answer to Your Questions:

### 1. **Do you need to deploy Limit Order Protocol on NEAR?**

❌ **NO** - NEAR has a completely different architecture. Instead, you'll:

- Deploy a custom escrow contract on NEAR (provided above)
- Use your TypeScript resolver to coordinate between chains
- Keep 1inch LOP only on Ethereum side

### 2. **What you need on NEAR side:**

✅ **Escrow Contract** (Rust smart contract - provided above)
✅ **TypeScript Resolver** (for cross-chain coordination)
✅ **Token Support** (NEAR native tokens or bridged tokens)
✅ **NEAR API integration** (near-api-js)

### 3. **Making it bidirectional:**

- Your current setup is Ethereum → BSC (both EVM)
- For Ethereum ↔ NEAR, you need different approaches for each direction

## Implementation Steps

### Step 1: Install Dependencies

```bash
# Add NEAR dependencies to your project
npm install near-api-js
npm install --save-dev near-cli

# For NEAR contract development
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
rustup target add wasm32-unknown-unknown
```

### Step 2: Deploy NEAR Contract

```bash
# Build the NEAR contract
cd near-contract
chmod +x build.sh
./build.sh

# Deploy to testnet
near login
near create-account your-escrow.testnet --masterAccount your-account.testnet
near deploy --wasmFile ./res/cross_chain_escrow.wasm --accountId your-escrow.testnet

# Initialize the contract
near call your-escrow.testnet new '{"owner": "your-account.testnet"}' --accountId your-account.testnet
```

### Step 3: Update Your TypeScript Resolver

Replace your current resolver with the new `EthereumNEARResolver`:

```typescript
// In your test file, replace the resolver setup:
import {EthereumNEARResolver, initializeNEAR} from './ethereum-near-resolver'

// Initialize NEAR
const nearConfig = await initializeNEAR('your-account.testnet', 'your-private-key', 'testnet')

// Create the resolver
const resolver = new EthereumNEARResolver(
    ethProvider,
    nearConfig,
    resolverPrivateKey,
    ethEscrowFactoryAddress,
    ethLimitOrderProtocolAddress
)
```

### Step 4: Token Support Options

#### Option A: Use Rainbow Bridge (Recommended for hackathon)

```typescript
// Use bridged tokens like:
const BRIDGED_USDC = 'usdc.fakes.testnet' // Testnet USDC
const BRIDGED_ETH = 'eth.fakes.testnet' // Testnet ETH
```

#### Option B: Use Native NEAR tokens

```typescript
const NEAR_TOKEN = 'NEAR'
const WRAPPED_NEAR = 'wrap.testnet'
```

### Step 5: Modify Your Test Cases

```typescript
describe('ETH ↔ NEAR Cross-chain swaps', () => {
    it('should swap ETH USDC → NEAR USDC', async () => {
        const secret = generateRandomSecret()

        const result = await resolver.executeEthToNearSwap(
            ethOrder,
            signature,
            secret,
            'usdc.fakes.testnet', // NEAR USDC
            'user.testnet' // NEAR recipient
        )

        expect(result.status).toBe('completed')
    })

    it('should swap NEAR USDC → ETH USDC', async () => {
        const nearOrder = {
            orderId: 'near_order_123',
            maker: 'user.testnet',
            taker: 'resolver.testnet',
            tokenIn: 'usdc.fakes.testnet',
            tokenOut: '0xA0b86a33E6441b39C45a5d8b3D8A8A5A8b2e5C94', // ETH USDC
            amountIn: '100000000', // 100 USDC
            amountOut: '99000000', // 99 USDC (with fees)
            deadline: Date.now() + 24 * 60 * 60 * 1000,
            secretHash: hashSecret(secret)
        }

        const result = await resolver.executeNearToEthSwap(
            nearOrder,
            '0xA0b86a33E6441b39C45a5d8b3D8A8A5A8b2e5C94', // ETH USDC
            '0x1234...', // ETH recipient
            secret
        )

        expect(result.status).toBe('completed')
    })
})
```

## Key Differences from EVM Chains

### Architecture

| Aspect    | Ethereum/BSC  | NEAR                 |
| --------- | ------------- | -------------------- |
| VM        | EVM           | NEAR Runtime         |
| Languages | Solidity      | Rust, AssemblyScript |
| Accounts  | Address-based | Named accounts       |
| Gas       | Wei/Gwei      | TGas (10^12 gas)     |
| Finality  | ~15 minutes   | ~2-3 seconds         |

### Transaction Structure

```javascript
// Ethereum
const tx = {
    to: '0x1234...',
    data: '0xabcd...',
    value: '1000000000000000000'
}

// NEAR
const tx = {
    receiverId: 'contract.testnet',
    actions: [
        {
            functionCall: {
                methodName: 'withdraw_with_secret',
                args: {escrow_id: '123', secret: 'abc'},
                gas: '300000000000000',
                deposit: '0'
            }
        }
    ]
}
```

## For Your Hackathon

### Minimum Viable Product (MVP):

1. ✅ Keep existing ETH → BSC swap working
2. ✅ Add ETH → NEAR swap (unidirectional first)
3. ✅ Use bridged USDC/ETH on NEAR via Rainbow Bridge
4. ✅ Simple UI showing swap progress

### Advanced Features (if time permits):

1. 🔄 NEAR → ETH swaps (bidirectional)
2. 🔄 Multiple token pairs
3. 🔄 Automatic market making
4. 🔄 Fee optimization

### Quick Start for Hackathon:

```bash
# 1. Clone and setup
git clone your-repo
npm install
npm install near-api-js

# 2. Deploy NEAR contract
cd near-contract
./build.sh --deploy

# 3. Update resolver
# Replace resolver.ts with ethereum-near-resolver.ts

# 4. Test with testnet tokens
npm test
```

## Common Issues & Solutions

### Issue: "Cannot find module 'near-api-js'"

```bash
npm install near-api-js @types/near-api-js
```

### Issue: NEAR contract deployment fails

```bash
near login
near create-account sub.your-account.testnet --masterAccount your-account.testnet
```

### Issue: Gas estimation errors

```javascript
// Use fixed gas amounts for NEAR
gas: '300000000000000' // 300 TGas
```

## Resources

- [NEAR Docs](https://docs.near.org/)
- [Rainbow Bridge](https://rainbowbridge.app/)
- [NEAR Examples](https://github.com/near-examples)
- [Cross-chain patterns](https://github.com/aurora-is-near/aurora-relayer)
