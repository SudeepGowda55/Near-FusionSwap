# Near-FusionSwap

A cross-chain decentralized exchange (DEX) enabling seamless token swaps between Polygon and NEAR Protocol using Hash Time Locked Contracts (HTLCs) and the 1inch Fusion+ cross-chain infrastructure.


<img width="1418" height="842" alt="Screenshot 2025-08-03 at 11 50 15 PM" src="https://github.com/user-attachments/assets/03cacef2-4b91-4241-9719-c3ae11dd87b1" />


## Video Demonstration

[![Near-FusionSwap Demo](https://img.youtube.com/vi/mxFI6glcaMY/0.jpg)](https://youtu.be/mxFI6glcaMY)

**[Watch the Full Demo](https://youtu.be/mxFI6glcaMY)** - See Near-FusionSwap in action with a complete walkthrough of cross-chain swaps between Polygon and NEAR Protocol.

## Features

- **Cross-Chain Swaps**: Seamlessly swap tokens between Polygon and NEAR Protocol
- **HTLC Security**: Trustless atomic swaps using Hash Time Locked Contracts
- **1inch Integration**: Leverages 1inch's cross-chain SDK for optimal routing
- **Modern UI**: Clean, responsive interface built with Next.js and Tailwind CSS
- **Real-time Pricing**: Live token price feeds with automatic rate calculations
- **Wallet Integration**: Support for MetaMask and NEAR Wallet
- **Test Environment**: Complete testing setup with hardcoded test accounts

## Architecture

```
Near-FusionSwap/
├── frontend/          # Next.js React application
├── backend/           # NestJS API server
├── evm-near-fusion+/  # Smart contracts
│   ├── polygon/       # Polygon smart contracts (Solidity)
│   └── near/          # NEAR smart contracts (Rust)
```

### Components Overview

- **Frontend**: Next.js application with TypeScript, Tailwind CSS, and Wagmi for wallet interactions
- **Backend**: NestJS API handling cross-chain swap logic and order management
- **Smart Contracts**: 
  - Polygon: Solidity contracts for escrow and resolution
  - NEAR: Rust contracts for HTLC implementation
- **Cross-Chain Bridge**: 1inch cross-chain SDK integration

### HTLC Workflow Phases

The cross-chain swap process operates in two distinct phases using Hash Time Locked Contracts (HTLCs) to ensure atomic, trustless swaps between Polygon and NEAR Protocol:

#### Phase 1: NEAR as Destination (Polygon → NEAR Swap)
When users want to swap tokens **FROM Polygon TO NEAR**:

- [NEAR] **User Account**: `goldrogerswap.testnet` (wants WETH tokens)
- [NEAR] **Resolver Account**: `htlc.testnet` (facilitates the swap on NEAR)
- [POLYGON] **User Account**: `0xC15e658AC13a89E8D2E5adBBcf29D5d168554553` (wants NEAR tokens)
- [NEAR] **Resolver Account**: `0x77ed0fef5e9DFB34e776adb11c29dd19d382745C` (facilitates the swap on POLYGON)

https://polygonscan.com/address/0x77ed0fef5e9dfb34e776adb11c29dd19d382745c

<img width="1300" height="822" alt="Screenshot 2025-08-03 at 9 56 20 PM" src="https://github.com/user-attachments/assets/41ac914a-a3b1-421a-a51d-ff711763107a" />

<br/>

**Detailed Process Flow:**
1. **HTLC Creation**: Resolver (`htlc.testnet`) creates a new HTLC contract on NEAR Protocol
2. **Funding**: Resolver deposits NEAR tokens into the HTLC and sets `is_destination = true`
3. **Secret Reveal**: User reveals the secret hash to claim NEAR tokens from the HTLC
4. **Cross-Chain Claim**: Using the revealed secret, Resolver claims USDC/WETH from the Polygon HTLC
5. **Completion**: Atomic swap completed - User receives NEAR, Resolver receives Polygon tokens


<img width="1115" height="858" alt="Screenshot 2025-08-03 at 9 57 28 PM" src="https://github.com/user-attachments/assets/fddcb8ae-fead-4030-9988-9d44282155d3" />



#### Phase 2: NEAR as Source (NEAR → Polygon Swap)
When users want to swap tokens **FROM NEAR TO Polygon**:

- **User Account**: `goldrogerswap.testnet` (wants Polygon tokens)
- **Resolver Account**: `htlc.testnet` (facilitates the swap)


<img width="1440" height="864" alt="Screenshot 2025-08-03 at 11 48 24 PM" src="https://github.com/user-attachments/assets/dad742bb-7372-40fa-b4d8-687790d6d493" />

<br/>
<br/>
<br/>


<img width="1032" height="747" alt="Screenshot 2025-08-03 at 9 57 18 PM" src="https://github.com/user-attachments/assets/4392fe0c-0d23-4c75-846d-f32d16a369de" />


**Detailed Process Flow:**
1. **HTLC Creation**: User (`goldrogerswap.testnet`) creates a new HTLC contract on NEAR Protocol
2. **Funding**: User deposits NEAR tokens into the HTLC and sets `is_destination = false`
3. **Secret Reveal**: Resolver reveals the secret hash to claim NEAR tokens from the HTLC
4. **Cross-Chain Claim**: Using the revealed secret, User claims ETH/USDC tokens from the Polygon HTLC
5. **Completion**: Atomic swap completed - Resolver receives NEAR, User receives Polygon tokens


<img width="1142" height="857" alt="Screenshot 2025-08-03 at 9 56 45 PM" src="https://github.com/user-attachments/assets/9628a8a6-64ca-4bbc-90f9-e53165a16d11" />


#### Security Features
- **Time Locks**: All HTLCs have expiration times for automatic refunds if swaps fail
- **Hash Secrets**: Cryptographic secrets ensure atomic execution across both chains
- **No Counterparty Risk**: Neither party can steal funds due to HTLC constraints

## Technology Stack

### Frontend
- **Framework**: Next.js 14 with TypeScript
- **Styling**: Tailwind CSS + Radix UI components
- **Wallet Integration**: Wagmi, MetaMask SDK
- **State Management**: React hooks
- **HTTP Client**: Fetch API with custom error handling

### Backend
- **Framework**: NestJS with TypeScript
- **Blockchain**: Ethers.js for Polygon, near-api-js for NEAR
- **Cross-Chain**: 1inch Cross-Chain SDK
- **API**: RESTful endpoints with CORS support

### Smart Contracts
- **Polygon**: Solidity contracts using Foundry framework
- **NEAR**: Rust contracts with cargo-near build system
- **Security**: HTLC pattern for atomic swaps

## Prerequisites

- **Node.js**: v18.0.0 or higher
- **npm/yarn**: Latest version
- **Rust**: For NEAR contract development
- **Foundry**: For Polygon contract development
- **Git**: For version control

## Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/SudeepGowda55/Near-FusionSwap.git
cd Near-FusionSwap
```

### 2. Setup Frontend

```bash
cd frontend
npm install
cp .env.example .env.local
# Edit .env.local to set NEXT_PUBLIC_BACKEND_URL if different from default
npm run dev
```

The frontend will be available at `http://localhost:3000`

### 3. Setup Backend

```bash
cd ../backend
npm install
yarn start:dev
```

The backend API will be available at `https://37623a0a3f91.ngrok-free.app`

### 4. Setup Smart Contracts

#### Polygon Contracts
```bash
cd ../evm-near-fusion+/polygon
npm install
forge build
npm test
```

#### NEAR Contracts
```bash
cd ../near
cargo build --target wasm32-unknown-unknown --release
```

## Configuration

### Environment Variables

#### Frontend (`.env.local`)
```env
NEXT_PUBLIC_BACKEND_URL=https://37623a0a3f91.ngrok-free.app
NEXT_PUBLIC_CHAIN_ID=137
```

#### Backend (`.env`)
```env
PORT=3001
POLYGON_RPC_URL=https://polygon-rpc.com
NEAR_NETWORK=testnet
PRIVATE_KEY=your_private_key_here
```

### Network Configuration

The application supports:
- **Polygon Mainnet** (Chain ID: 137)
- **NEAR Mainnet** (for production)

## Usage

### Basic Swap Flow

1. **Connect Wallet**: Connect your MetaMask wallet to Polygon network
2. **Select Tokens**: Choose WETH on Polygon to swap for NEAR tokens
3. **Enter Amount**: Specify the amount you want to swap
4. **Approve Token**: Approve token spending (one-time setup)
5. **Cross-Chain Details**: Provide NEAR account details
6. **Execute Swap**: Confirm the cross-chain transaction
7. **Monitor Status**: Track swap progress in real-time

### Supported Token Pairs

- **WETH (Polygon)** ↔ **NEAR (NEAR Protocol)**
- Additional ERC-20 tokens (USDC, USDT, DAI) coming soon

### Test Accounts

For testing purposes, the application includes pre-configured test accounts:


- **Test NEAR Account**: `goldrogerswap.testnet`
- **Test Address**: `0xC15e658AC13a89E8D2E5adBBcf29D5d168554553`

## Testing

### Frontend Tests
```bash
cd frontend
npm test
npm run test:coverage
```

### Backend Tests
```bash
cd backend
npm test
npm run test:e2e
```

### Smart Contract Tests
```bash
# Polygon contracts
cd evm-near-fusion+/polygon
npm test

# NEAR contracts
cd ../near
cargo test
```

## API Documentation

### Backend Endpoints

#### POST `/polygon-to-near/`
Initiates a cross-chain swap from Polygon to NEAR.

**Request Body:**
```json
{
  "makerPk": "string",
  "srcChainId": 137,
  "makerAssetAddress": "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619",
  "takerAssetAddress": "0x0000000000000000000000000000000000000000",
  "makingAmount": 0.001,
  "takingAmount": 0.014,
  "makerNearAccountId": "account.testnet"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Swap from Polygon to NEAR successfully",
  "data": {
    "orderHash": "0x...",
    "blockHash": "0x...",
    "txHash": "0x..."
  }
}
```

## Security

### Smart Contract Security
- **HTLC Pattern**: Ensures atomic swaps without counterparty risk
- **Time Locks**: Automatic refunds if swaps aren't completed
- **Multi-signature**: Support for multi-sig wallet integration

### API Security
- **CORS Protection**: Configured for secure cross-origin requests
- **Input Validation**: Comprehensive validation of all API inputs
- **Rate Limiting**: Protection against spam and DoS attacks

### Best Practices
- Private keys are never logged or exposed
- All transactions are signed client-side
- Secure random number generation for HTLC secrets

## Contributing

We welcome contributions! Please follow these steps:

1. **Fork the Repository**
2. **Create Feature Branch**: `git checkout -b feature/amazing-feature`
3. **Commit Changes**: `git commit -m 'Add amazing feature'`
4. **Push to Branch**: `git push origin feature/amazing-feature`
5. **Open Pull Request**

### Development Guidelines

- Follow TypeScript/JavaScript style guides
- Write comprehensive tests for new features
- Update documentation for API changes
- Use conventional commit messages

## Troubleshooting

### Common Issues

#### CORS Errors
- Ensure backend is running on port 3001
- Check that frontend is using the API proxy route

#### Wallet Connection Issues
- Verify MetaMask is installed and unlocked
- Switch to Polygon network (Chain ID: 137)
- Check wallet permissions

#### Transaction Failures
- Ensure sufficient gas and token balances
- Verify contract addresses are correct
- Check network connectivity

### Getting Help

- **GitHub Issues**: Report bugs and request features
- **Discord**: Join our community for real-time help
- **Documentation**: Check our comprehensive docs

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- **1inch Network**: For cross-chain infrastructure and SDK
- **NEAR Protocol**: For blockchain infrastructure and developer tools
- **Polygon**: For scalable Ethereum infrastructure
- **Community**: All contributors and testers

## Contact

- **GitHub**: [@SudeepGowda55](https://github.com/SudeepGowda55)
- **Project Link**: [Near-FusionSwap](https://github.com/SudeepGowda55/Near-FusionSwap)

---

**Built with ❤️ for the cross-chain future**
