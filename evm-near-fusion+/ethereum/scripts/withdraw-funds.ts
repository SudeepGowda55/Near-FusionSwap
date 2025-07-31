import hre from "hardhat";
import { readFileSync, readdirSync, writeFileSync } from "fs";
import { join } from "path";

async function main() {
  // Get order hash from environment variable
  const ORDER_HASH = process.env.ORDER_HASH;

  if (!ORDER_HASH || !ORDER_HASH.startsWith("0x")) {
    console.log("❌ Please provide ORDER_HASH environment variable");
    console.log("   Usage: ORDER_HASH=0x... npx hardhat run scripts/withdraw-funds.ts");
    process.exitCode = 1;
    return;
  }

  // Determine which chain escrow to withdraw from: 'src' or 'dst'
  const CHAIN = process.env.CHAIN?.toLowerCase() || "src";
  if (!["src", "dst"].includes(CHAIN)) {
    console.log("❌ Invalid CHAIN env var. Use 'src' or 'dst'.");
    process.exitCode = 1;
    return;
  }

  // Read order details from file based on order hash
  const ordersDir = join(__dirname, "..", "orders");
  const orderFilePath = join(ordersDir, `${ORDER_HASH}.json`);

  try {
    const orderData = JSON.parse(readFileSync(orderFilePath, "utf8"));

    // Select escrow address and deployed immutables based on chain
    let ESCROW_ADDRESS: string;
    let deployedImmutablesData: any;
    let CONTRACT_NAME: string;
    if (CHAIN === "src") {
      if (!orderData.srcEscrowAddress || !orderData.deployedImmutables) {
        console.log("❌ Source escrow has not been deployed yet");
        process.exitCode = 1;
        return;
      }
      ESCROW_ADDRESS = orderData.srcEscrowAddress;
      deployedImmutablesData = orderData.deployedImmutables;
      CONTRACT_NAME = "EscrowSrc";
    } else {
      if (!orderData.dstEscrowAddress || !orderData.deployedDstImmutables) {
        console.log("❌ Destination escrow has not been deployed yet");
        process.exitCode = 1;
        return;
      }
      ESCROW_ADDRESS = orderData.dstEscrowAddress;
      deployedImmutablesData = orderData.deployedDstImmutables;
      CONTRACT_NAME = "EscrowDst";
    }

    console.log("📋 Withdrawing from:", CHAIN, "-escrow", ESCROW_ADDRESS);

    // Extract data from order file
    const SECRET = orderData.secret;
    const deployedImmutables = {
      orderHash: deployedImmutablesData.orderHash,
      hashlock: deployedImmutablesData.hashlock,
      maker: BigInt(deployedImmutablesData.maker),
      taker: BigInt(deployedImmutablesData.taker),
      token: BigInt(deployedImmutablesData.token),
      amount: BigInt(deployedImmutablesData.amount),
      safetyDeposit: BigInt(deployedImmutablesData.safetyDeposit),
      timelocks: BigInt(deployedImmutablesData.timelocks),
    };

    // Use the accounts from your hardhat config
    const publicClient = await hre.viem.getPublicClient();
    const [deployer] = await hre.viem.getWalletClients();

    // For this demo, we'll use the same account as taker
    const taker = deployer;

    console.log("🎉 Starting withdrawal process...");
    console.log("👤 Taker address:", taker.account.address);
    console.log("🏠 Escrow address:", ESCROW_ADDRESS);
    console.log("🔐 Secret:", SECRET);

    // Get the escrow contract
    const escrow = await hre.viem.getContractAt(CONTRACT_NAME, ESCROW_ADDRESS as `0x${string}`);

    // Extract deployment timestamp from the timelocks (stored in the high 32 bits)
    const deploymentTime = deployedImmutables.timelocks >> BigInt(224);

    console.log("🕐 Deployment timestamp:", deploymentTime.toString());

    // Calculate withdrawal window using deployment time + relative timeout
    const deployedTimelocks = deployedImmutables.timelocks;

    // Extract the srcWithdrawal timeout from the packed timelocks (first 32 bits)
    const srcWithdrawalTimeout = Number(deployedTimelocks & BigInt(0xffffffff));
    const withdrawalStart = deploymentTime + BigInt(srcWithdrawalTimeout);

    // Get current block timestamp
    const currentBlock = await publicClient.getBlock();
    const currentBlockTime = currentBlock.timestamp;

    console.log("📅 Current block time:", currentBlockTime.toString());
    console.log("📅 Withdrawal starts at:", withdrawalStart.toString());

    // Wait if we're too early (based on block time, not wall clock time)
    if (currentBlockTime < withdrawalStart) {
      const waitTimeSeconds = Number(withdrawalStart - currentBlockTime) + 15; // Extra buffer
      console.log(`⏳ Waiting ${waitTimeSeconds} seconds for withdrawal window...`);
      await new Promise((resolve) => setTimeout(resolve, waitTimeSeconds * 1000));
    }

    // Taker withdraws using the secret
    try {
      console.log("\n🔍 Simulating withdraw call...");
      await publicClient.simulateContract({
        address: ESCROW_ADDRESS as `0x${string}`,
        abi: await hre.artifacts.readArtifact(CONTRACT_NAME).then((a) => a.abi),
        functionName: "withdraw",
        args: [SECRET, deployedImmutables],
        account: taker.account.address,
      });
      console.log("✅ Simulation successful, proceeding with transaction...");

      const withdrawTx = await escrow.write.withdraw([SECRET, deployedImmutables], {
        account: taker.account,
        gas: 300000n, // Set gas limit for withdraw
      });

      console.log("📝 Withdraw tx:", withdrawTx);

      const withdrawReceipt = await publicClient.waitForTransactionReceipt({
        hash: withdrawTx,
        timeout: 120_000, // 2 minutes timeout
      });

      if (withdrawReceipt.status === "success") {
        console.log("✅ Taker successfully claimed funds in block:", withdrawReceipt.blockNumber);

        // Update order file with withdrawal results
        const withdrawalResults = {
          withdrawalTx: withdrawTx,
          withdrawalBlock: withdrawReceipt.blockNumber.toString(),
          withdrawalTimestamp: new Date().toISOString(),
          status: "COMPLETED",
        };

        const updatedOrderData = {
          ...orderData,
          ...withdrawalResults,
        };

        writeFileSync(orderFilePath, JSON.stringify(updatedOrderData, null, 2));
        console.log("💾 Updated order file with withdrawal results");
      } else {
        console.log("❌ Withdraw transaction failed!");
      }
    } catch (error: any) {
      console.log("❌ Withdraw failed:", error?.shortMessage || error?.message || "Unknown error");
      process.exitCode = 1;
      return;
    }

    // Check final balances
    const finalEscrowBalance = await publicClient.getBalance({
      address: ESCROW_ADDRESS as `0x${string}`,
    });

    console.log("\n📊 Final Results:");
    console.log("   Escrow balance after claim:", finalEscrowBalance.toString(), "wei");
    console.log("\n🎯 Withdrawal Complete!");
    console.log("✅ Taker successfully claimed funds using secret");
    console.log("✅ Withdrawal transaction completed!");
  } catch (error) {
    console.log("❌ Order file not found:", orderFilePath);
    console.log("   Make sure the order hash is correct and the order exists");
    process.exitCode = 1;
    return;
  }
}

main().catch((error) => {
  console.error("❌ Error:", error);
  process.exitCode = 1;
});
