import hre from "hardhat";

async function main() {
  const RESCUE_DELAY_SRC = 7 * 24 * 60 * 60; // 7 days
  const RESCUE_DELAY_DST = 7 * 24 * 60 * 60; // 7 days

  console.log("📦 Deploying EscrowFactory...");

  const factory = await hre.viem.deployContract("EscrowFactory", [
    RESCUE_DELAY_SRC,
    RESCUE_DELAY_DST,
  ]);

  const factoryAddress = factory.address;
  const srcImplementation = await factory.read.ESCROW_SRC_IMPLEMENTATION();
  const dstImplementation = await factory.read.ESCROW_DST_IMPLEMENTATION();

  console.log("✅ EscrowFactory deployed at:", factoryAddress);
  console.log("✅ Escrow Source Implementation:", srcImplementation);
  console.log("✅ Escrow Destination Implementation:", dstImplementation);
  console.log("Deployment Network:", hre.network.name);

  console.log("\n⏳ Waiting for 30 seconds before submitting contract code for verification...");
  await new Promise((resolve) => setTimeout(resolve, 30000)); // Wait 30 seconds

  // Verify contracts on Etherscan
  try {
    console.log("\n🔍 Starting contract verification...");

    // Verify EscrowFactory
    console.log("📋 Verifying EscrowFactory...");
    await hre.run("verify:verify", {
      address: factoryAddress,
      constructorArguments: [RESCUE_DELAY_SRC, RESCUE_DELAY_DST],
    });
    console.log("✅ EscrowFactory verified on Etherscan");

    console.log(
      "\n⏳ Waiting for another 40 seconds before submitting src & dest escrow contract code for verification..."
    );
    await new Promise((resolve) => setTimeout(resolve, 40000)); // Wait 40 seconds

    // Verify EscrowSrc implementation
    console.log("📋 Verifying EscrowSrc implementation...");
    await hre.run("verify:verify", {
      address: srcImplementation,
      constructorArguments: [RESCUE_DELAY_SRC],
    });
    console.log("✅ EscrowSrc implementation verified on Etherscan");

    // Verify EscrowDst implementation
    console.log("📋 Verifying EscrowDst implementation...");
    await hre.run("verify:verify", {
      address: dstImplementation,
      constructorArguments: [RESCUE_DELAY_DST],
    });
    console.log("✅ EscrowDst implementation verified on Etherscan");
  } catch (error) {
    console.error("❌ Verification failed:", error);
    console.log("💡 You can manually verify the contracts using:");
    console.log(
      `   npx hardhat verify --network ${hre.network.name} ${factoryAddress} ${RESCUE_DELAY_SRC} ${RESCUE_DELAY_DST}`
    );
    console.log(
      `   npx hardhat verify --network ${hre.network.name} ${srcImplementation} ${RESCUE_DELAY_SRC}`
    );
    console.log(
      `   npx hardhat verify --network ${hre.network.name} ${dstImplementation} ${RESCUE_DELAY_DST}`
    );
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
