// This setup uses Hardhat Ignition to manage smart contract deployments.
// Learn more about it at https://hardhat.org/ignition

import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const EscrowFactoryModule = buildModule("EscrowFactoryModule", (m) => {
  const RESCUE_DELAY_SRC = 7 * 24 * 60 * 60; // 7 days
  const RESCUE_DELAY_DST = 7 * 24 * 60 * 60; // 7 days

  console.log("📦 Deploying EscrowFactory...");
  const escrowFactory = m.contract("EscrowFactory", [RESCUE_DELAY_SRC, RESCUE_DELAY_DST]);

  console.log("✅ EscrowFactory deployment initiated");
  console.log("Rescue delay for source chain:", RESCUE_DELAY_SRC, "seconds (7 days)");
  console.log("Rescue delay for destination chain:", RESCUE_DELAY_DST, "seconds (7 days)");

  return { escrowFactory };
});

export default EscrowFactoryModule;
