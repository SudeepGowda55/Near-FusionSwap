import hre from "hardhat";
import { keccak256, parseEther, zeroAddress, decodeEventLog } from "viem";
import fs from "fs";
import path from "path";

async function main() {
  const FACTORY_ADDRESS = "0x507877f0d61c9c06cdadc4335baae85331b0ea6d";

  // Use the accounts from your hardhat config
  const publicClient = await hre.viem.getPublicClient();
  const [deployer] = await hre.viem.getWalletClients();

  // For this demo, we'll use the same account as both maker and taker
  // In a real scenario, these would be different users
  const maker = deployer;
  const taker = deployer; // Using same account for simplicity

  console.log("🏭 Using EscrowFactory at:", FACTORY_ADDRESS);
  console.log("👤 Maker address:", maker.account.address);

  // 1) Get order hash from environment variable
  const ORDER_HASH = process.env.ORDER_HASH;

  if (!ORDER_HASH || !ORDER_HASH.startsWith("0x")) {
    console.log("❌ Please provide ORDER_HASH environment variable");
    console.log("   Usage: ORDER_HASH=0x... npx hardhat run scripts/deploy-src-escrow.ts");
    process.exitCode = 1;
    return;
  } // Read order details from file based on order hash
  const ordersDir = path.join(__dirname, "..", "orders");
  const orderFilePath = path.join(ordersDir, `${ORDER_HASH}.json`);

  let orderData;
  try {
    orderData = JSON.parse(fs.readFileSync(orderFilePath, "utf8"));
  } catch (error) {
    console.log("❌ Order file not found:", orderFilePath);
    console.log("   Make sure the order hash is correct and the order exists");
    process.exitCode = 1;
    return;
  }

  console.log("📋 Using order:", orderData.orderHash);
  console.log("🔐 Secret from file:", orderData.secret);

  // Extract data from order file
  const orderHash = orderData.orderHash as `0x${string}`;
  const secret = orderData.secret as `0x${string}`;
  const secretHash = keccak256(secret);
  const timeouts = orderData.timeLockParams;

  // 2) Pack timelocks from order file
  let packedTimelocks = BigInt(0);
  packedTimelocks |= BigInt(timeouts.srcWithdrawal);
  packedTimelocks |= BigInt(timeouts.srcPublicWithdrawal) << BigInt(32);
  packedTimelocks |= BigInt(timeouts.srcCancellation) << BigInt(64);
  packedTimelocks |= BigInt(timeouts.srcPublicCancellation) << BigInt(96);
  packedTimelocks |= BigInt(timeouts.dstWithdrawal) << BigInt(128);
  packedTimelocks |= BigInt(timeouts.dstPublicWithdrawal) << BigInt(160);
  packedTimelocks |= BigInt(timeouts.dstCancellation) << BigInt(192);

  // 3) Create immutables struct
  // Note: Address type in 1inch contracts is uint256, so we convert addresses to BigInt
  const amount = parseEther("0.00001"); // 0.00001 ETH
  const safetyDeposit = BigInt(orderData.safetyDeposits?.src || "1000000000"); // Already in wei, parse as BigInt

  const immutables = {
    orderHash: orderHash,
    hashlock: secretHash,
    maker: BigInt(maker.account.address), // Convert address to BigInt
    taker: BigInt(taker.account.address), // Convert address to BigInt
    token: BigInt(zeroAddress), // ETH (zeroAddress converted to BigInt)
    amount: amount,
    safetyDeposit: safetyDeposit,
    timelocks: packedTimelocks,
  };

  // 4) Get factory contract
  const factory = await hre.viem.getContractAt("EscrowFactory", FACTORY_ADDRESS);

  // 5) Predict the correct source escrow address by simulating what the factory will do
  // The factory will copy immutables to memory and set deployment timestamp
  // We need to simulate this to get the correct prediction

  // Get current block timestamp to simulate what the factory will do
  const currentBlockForPrediction = await publicClient.getBlock();
  const predictedDeploymentTime = currentBlockForPrediction.timestamp;

  // Create a copy of immutables and simulate the factory's setDeployedAt operation
  const predictedImmutables = { ...immutables };

  // Simulate TimelocksLib.setDeployedAt(timelocks, deploymentTime)
  // This sets the deployment timestamp in the high 32 bits (bits 224-255)
  const clearedTimelocks = immutables.timelocks & ((BigInt(1) << BigInt(224)) - BigInt(1)); // Clear top 32 bits
  const timestampShifted = BigInt(predictedDeploymentTime) << BigInt(224); // Shift timestamp to top 32 bits
  predictedImmutables.timelocks = clearedTimelocks | timestampShifted;

  const srcEscrowAddr = await factory.read.addressOfEscrowSrc([predictedImmutables]);
  console.log("\n🎯 Predicted source escrow address:", srcEscrowAddr);

  // 6) Deploy source escrow with funding
  const srcValue = immutables.amount + immutables.safetyDeposit;
  console.log("\n💰 Deploying source escrow with", srcValue.toString(), "wei...");

  const createSrcTx = await factory.write.createSrcEscrow([immutables], {
    value: srcValue,
    account: maker.account,
    gas: 500000n, // Set a reasonable gas limit
  });

  console.log("📝 Source escrow creation tx:", createSrcTx);

  // Wait for confirmation with longer timeout
  console.log("⏳ Waiting for transaction confirmation...");
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: createSrcTx,
    timeout: 120_000, // 2 minutes timeout
  });
  console.log("✅ Source escrow deployed in block:", receipt.blockNumber);

  // Decode the SrcEscrowCreated event to get the actual immutables and escrow address
  let actualEscrowAddr: `0x${string}` = srcEscrowAddr; // Default to predicted
  let deployedImmutables: any = immutables; // Default to original
  let dstComplement: any;

  if (receipt.logs.length > 0) {
    try {
      // Get the factory contract ABI to decode events
      const factoryArtifact = await hre.artifacts.readArtifact("EscrowFactory");

      // Find and decode the SrcEscrowCreated event
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: factoryArtifact.abi,
            data: log.data,
            topics: log.topics,
          });

          if (decoded.eventName === "SrcEscrowCreated") {
            deployedImmutables = decoded.args.srcImmutables;
            dstComplement = decoded.args.dstImmutablesComplement;

            console.log("🎯 Decoded SrcEscrowCreated event");

            // Compute the actual escrow address using the deployed immutables
            actualEscrowAddr = await factory.read.addressOfEscrowSrc([deployedImmutables]);
            console.log("🎯 Actual escrow address:", actualEscrowAddr);

            if (srcEscrowAddr.toLowerCase() === actualEscrowAddr.toLowerCase()) {
              console.log("✅ Address prediction was correct!");
            } else {
              console.log("⚠️  Address prediction mismatch (timing difference)");
            }
            break;
          }
        } catch (e) {
          // Skip logs that can't be parsed
          continue;
        }
      }

      if (!dstComplement) {
        console.log("⚠️  SrcEscrowCreated event not found, using predicted values");
      }
    } catch (error) {
      console.log("⚠️  Error decoding events, using predicted values:", error);
    }
  } else {
    console.log("⚠️  No events found, using predicted address:", actualEscrowAddr);
  }

  // 7) Verify the escrow was created and funded
  const escrowBalance = await publicClient.getBalance({ address: actualEscrowAddr });
  console.log("💰 Escrow balance:", escrowBalance.toString(), "wei");

  console.log("\n� Source Escrow Deployment Complete!");
  console.log("✅ Source escrow deployed at:", actualEscrowAddr);
  console.log("✅ Funded with:", srcValue.toString(), "wei");
  console.log("✅ Event-sourced immutables captured");

  if (dstComplement) {
    console.log("\n🌐 Destination Chain Info:");
    console.log("   Dst Chain ID:", dstComplement.chainId.toString());
    console.log("   Dst Amount:", dstComplement.amount.toString());
  }

  // Export deployment data for use by other scripts
  console.log("\n📋 Deployment Data (for withdraw script):");
  console.log("   Secret:", secret);
  console.log("   Escrow Address:", actualEscrowAddr);
  console.log("   Transaction Hash:", createSrcTx);
  console.log("   Block Number:", receipt.blockNumber.toString());

  // 8) Update order file with deployment results for resolver
  const deploymentResults = {
    srcEscrowAddress: actualEscrowAddr,
    srcDeploymentTx: createSrcTx,
    srcDeploymentBlock: receipt.blockNumber.toString(),
    srcDeploymentTimestamp: new Date().toISOString(),
    deployedImmutables: {
      orderHash: deployedImmutables.orderHash,
      hashlock: deployedImmutables.hashlock,
      maker: deployedImmutables.maker.toString(),
      taker: deployedImmutables.taker.toString(),
      token: deployedImmutables.token.toString(),
      amount: deployedImmutables.amount.toString(),
      safetyDeposit: deployedImmutables.safetyDeposit.toString(),
      timelocks: deployedImmutables.timelocks.toString(),
    },
    dstImmutablesComplement: dstComplement
      ? {
          chainId: dstComplement.chainId.toString(),
          amount: dstComplement.amount.toString(),
        }
      : undefined,
    status: "SRC_DEPLOYED",
  };

  // Update the order file
  const updatedOrderData = {
    ...orderData,
    ...deploymentResults,
  };

  fs.writeFileSync(orderFilePath, JSON.stringify(updatedOrderData, null, 2));
  console.log("\n💾 Updated order file with deployment results");
  console.log("📁 File:", orderFilePath);
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exitCode = 1;
});
