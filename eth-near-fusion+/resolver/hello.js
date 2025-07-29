import { Hello } from "../ethereum/scripts/hello.js";

async function main() {
  const hello = new Hello();
  console.log(hello.getMessage());
}

main();
