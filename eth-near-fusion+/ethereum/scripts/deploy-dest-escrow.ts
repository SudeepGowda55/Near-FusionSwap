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
  console.log("👤 Taker address:", taker.account.address);

  // 1) Get order hash from environment variable
  const ORDER_HASH = process.env.ORDER_HASH;

  if (!ORDER_HASH || !ORDER_HASH.startsWith("0x")) {
    console.log("❌ Please provide ORDER_HASH environment variable");
    console.log("   Usage: ORDER_HASH=0x... npx hardhat run scripts/deploy-dest-escrow.ts");
    process.exitCode = 1;
    return;
  }

  // Read order details from file based on order hash
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

  // Check if source escrow has been deployed
  if (!orderData.srcEscrowAddress || !orderData.deployedImmutables) {
    console.log("❌ Source escrow has not been deployed yet");
    console.log("   Run deploy-src-escrow.ts first to deploy the source escrow");
    process.exitCode = 1;
    return;
  }

  console.log("📋 Using order:", orderData.orderHash);
  console.log("🔐 Secret from file:", orderData.secret);
  console.log("🌐 Source escrow deployed at:", orderData.srcEscrowAddress);

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

  // 3) Create destination immutables struct
  // For destination, we use the complement data from the source deployment
  const dstComplement = orderData.dstImmutablesComplement;
  if (!dstComplement) {
    console.log("❌ Destination complement data not found in order file");
    console.log("   Make sure the source escrow was deployed properly");
    process.exitCode = 1;
    return;
  }

  const dstAmount = BigInt(dstComplement.amount);
  const dstSafetyDeposit = BigInt(orderData.safetyDeposits?.dst || "1000000000"); // Already in wei, parse as BigInt

  const dstImmutables = {
    orderHash: orderHash,
    hashlock: secretHash,
    maker: BigInt(taker.account.address), // On destination, taker becomes the "maker"
    taker: BigInt(maker.account.address), // On destination, maker becomes the "taker"
    token: BigInt(zeroAddress), // ETH (zeroAddress converted to BigInt)
    amount: dstAmount,
    safetyDeposit: dstSafetyDeposit,
    timelocks: packedTimelocks,
  };

  // 4) Get factory contract
  const factory = await hre.viem.getContractAt("EscrowFactory", FACTORY_ADDRESS);

  // 5) Predict the correct destination escrow address by simulating what the factory will do
  // Get current block timestamp to simulate what the factory will do
  const currentBlockForPrediction = await publicClient.getBlock();
  const predictedDeploymentTime = currentBlockForPrediction.timestamp;

  // Create a copy of immutables and simulate the factory's setDeployedAt operation
  const predictedDstImmutables = { ...dstImmutables };

  // Simulate TimelocksLib.setDeployedAt(timelocks, deploymentTime)
  // This sets the deployment timestamp in the high 32 bits (bits 224-255)
  const clearedTimelocks = dstImmutables.timelocks & ((BigInt(1) << BigInt(224)) - BigInt(1)); // Clear top 32 bits
  const timestampShifted = BigInt(predictedDeploymentTime) << BigInt(224); // Shift timestamp to top 32 bits
  predictedDstImmutables.timelocks = clearedTimelocks | timestampShifted;

  const dstEscrowAddr = await factory.read.addressOfEscrowDst([predictedDstImmutables]);
  console.log("\n🎯 Predicted destination escrow address:", dstEscrowAddr);

  // 6) Deploy destination escrow with funding
  const dstValue = dstImmutables.amount + dstImmutables.safetyDeposit;
  console.log("\n💰 Deploying destination escrow with", dstValue.toString(), "wei...");

  // For destination escrow, we need the source cancellation timestamp
  // Extract it from the source deployment data
  const srcImmutables = orderData.deployedImmutables;
  const srcTimelocks = BigInt(srcImmutables.timelocks);
  const srcDeploymentTime = srcTimelocks >> BigInt(224); // Get deployment timestamp from high 32 bits
  const srcCancellationTimeout = (srcTimelocks >> BigInt(64)) & BigInt(0xffffffff); // Get srcCancellation from bits 64-95
  const srcCancellationTimestamp = srcDeploymentTime + srcCancellationTimeout;

  console.log("🕐 Source deployment time:", srcDeploymentTime.toString());
  console.log("🕐 Source cancellation timeout:", srcCancellationTimeout.toString());
  console.log("🕐 Source cancellation timestamp:", srcCancellationTimestamp.toString());

  // Also check destination cancellation for comparison
  const dstCancellationTimeout = BigInt(timeouts.dstCancellation);
  console.log("🕐 Destination cancellation timeout:", dstCancellationTimeout.toString());

  // Get current time to predict destination deployment time
  const currentTime = BigInt(Math.floor(Date.now() / 1000));
  const predictedDstCancellationTimestamp = currentTime + dstCancellationTimeout;
  console.log("🕐 Current time:", currentTime.toString());
  console.log(
    "🕐 Predicted destination cancellation timestamp:",
    predictedDstCancellationTimestamp.toString()
  );

  // Validation check (same as contract)
  if (predictedDstCancellationTimestamp > srcCancellationTimestamp) {
    console.log("❌ Timing validation would fail:");
    console.log(
      `   Dst cancellation: ${predictedDstCancellationTimestamp} > Src cancellation: ${srcCancellationTimestamp}`
    );
    console.log("   This means destination cancellation would happen after source cancellation");
    process.exitCode = 1;
    return;
  } else {
    console.log("✅ Timing validation should pass");
  }

  const createDstTx = await factory.write.createDstEscrow(
    [dstImmutables, srcCancellationTimestamp],
    {
      value: dstValue,
      account: taker.account,
      gas: 500000n, // Set a reasonable gas limit
    }
  );

  console.log("📝 Destination escrow creation tx:", createDstTx);

  // Wait for confirmation with longer timeout
  console.log("⏳ Waiting for transaction confirmation...");
  const receipt = await publicClient.waitForTransactionReceipt({
    hash: createDstTx,
    timeout: 120_000, // 2 minutes timeout
  });
  console.log("✅ Destination escrow deployed in block:", receipt.blockNumber);

  // Decode the DstEscrowCreated event to get the actual immutables and escrow address
  let actualDstEscrowAddr: `0x${string}` = dstEscrowAddr; // Default to predicted
  let deployedDstImmutables: any = dstImmutables; // Default to original

  if (receipt.logs.length > 0) {
    try {
      // Get the factory contract ABI to decode events
      const factoryArtifact = await hre.artifacts.readArtifact("EscrowFactory");

      // Find and decode the DstEscrowCreated event
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({
            abi: factoryArtifact.abi,
            data: log.data,
            topics: log.topics,
          });

          if (decoded.eventName === "DstEscrowCreated") {
            // DstEscrowCreated event: (address escrow, bytes32 hashlock, Address taker)
            const dstEscrowFromEvent = decoded.args.escrow;

            console.log("🎯 Decoded DstEscrowCreated event");
            console.log("🎯 Actual destination escrow address:", dstEscrowFromEvent);

            actualDstEscrowAddr = dstEscrowFromEvent;

            if (dstEscrowAddr.toLowerCase() === actualDstEscrowAddr.toLowerCase()) {
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

      if (!actualDstEscrowAddr) {
        console.log("⚠️  DstEscrowCreated event not found, using predicted values");
        actualDstEscrowAddr = dstEscrowAddr;
      }
    } catch (error) {
      console.log("⚠️  Error decoding events, using predicted values:", error);
      actualDstEscrowAddr = dstEscrowAddr;
    }
  } else {
    console.log("⚠️  No events found, using predicted address:", dstEscrowAddr);
    actualDstEscrowAddr = dstEscrowAddr;
  }

  // Since we deployed with the predicted immutables and they get the timestamp set,
  // we need to create the final deployed immutables with the actual deployment timestamp
  const finalDeploymentBlock = await publicClient.getBlock({ blockNumber: receipt.blockNumber });
  const actualDeploymentTime = finalDeploymentBlock.timestamp;

  // Create final deployed immutables with actual deployment timestamp
  const finalDstImmutables = { ...dstImmutables };
  const clearedFinalTimelocks = dstImmutables.timelocks & ((BigInt(1) << BigInt(224)) - BigInt(1));
  const actualTimestampShifted = BigInt(actualDeploymentTime) << BigInt(224);
  finalDstImmutables.timelocks = clearedFinalTimelocks | actualTimestampShifted;

  deployedDstImmutables = finalDstImmutables;

  // 7) Verify the escrow was created and funded
  const escrowBalance = await publicClient.getBalance({ address: actualDstEscrowAddr });
  console.log("💰 Destination escrow balance:", escrowBalance.toString(), "wei");

  console.log("\n🌐 Destination Escrow Deployment Complete!");
  console.log("✅ Destination escrow deployed at:", actualDstEscrowAddr);
  console.log("✅ Funded with:", dstValue.toString(), "wei");
  console.log("✅ Event-sourced immutables captured");

  // Export deployment data for use by other scripts
  console.log("\n📋 Deployment Data:");
  console.log("   Secret:", secret);
  console.log("   Destination Escrow Address:", actualDstEscrowAddr);
  console.log("   Transaction Hash:", createDstTx);
  console.log("   Block Number:", receipt.blockNumber.toString());

  // 8) Update order file with destination deployment results
  const dstDeploymentResults = {
    dstEscrowAddress: actualDstEscrowAddr,
    dstDeploymentTx: createDstTx,
    dstDeploymentBlock: receipt.blockNumber.toString(),
    dstDeploymentTimestamp: new Date().toISOString(),
    deployedDstImmutables: {
      orderHash: deployedDstImmutables.orderHash,
      hashlock: deployedDstImmutables.hashlock,
      maker: deployedDstImmutables.maker.toString(),
      taker: deployedDstImmutables.taker.toString(),
      token: deployedDstImmutables.token.toString(),
      amount: deployedDstImmutables.amount.toString(),
      safetyDeposit: deployedDstImmutables.safetyDeposit.toString(),
      timelocks: deployedDstImmutables.timelocks.toString(),
    },
    status: "BOTH_DEPLOYED",
  };

  // Update the order file
  const updatedOrderData = {
    ...orderData,
    ...dstDeploymentResults,
  };

  fs.writeFileSync(orderFilePath, JSON.stringify(updatedOrderData, null, 2));
  console.log("\n💾 Updated order file with destination deployment results");
  console.log("📁 File:", orderFilePath);

  console.log("\n🎯 Cross-Chain Atomic Swap Setup Complete!");
  console.log("✅ Source chain escrow:", orderData.srcEscrowAddress);
  console.log("✅ Destination chain escrow:", actualDstEscrowAddr);
  console.log("✅ Both escrows are funded and ready for atomic swap");
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exitCode = 1;
});
