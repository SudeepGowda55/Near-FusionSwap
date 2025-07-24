import hre from "hardhat";

async function main() {
  console.log("Running test script...");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
