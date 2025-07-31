Try running some of the following tasks:

```shell
npx hardhat help
```

For Contract Compilation

```shell
npm run compile
```

For Contract Deploy (Set Default network in hardhat.config.ts to proper network)

```shell
npm run deploy ./ignition/modules/count.ts
```

To run any file of scripts folder, run this cmd

```shell
npx hardhat run scripts/test.ts
```

ORDER_HASH=0xa76e0e27afec7e7f51e19e195703da5216e0dfceda6724eb9de064ab1b4ce802 npx hardhat run scripts/deploy-src-escrow.ts

ORDER_HASH=0xa76e0e27afec7e7f51e19e195703da5216e0dfceda6724eb9de064ab1b4ce801 npx hardhat run scripts/deploy-dest-escrow.ts

ORDER_HASH=0xa76e0e27afec7e7f51e19e195703da5216e0dfceda6724eb9de064ab1b4ce803 CHAIN=src npx hardhat run scripts/withdraw-funds.ts

ORDER_HASH=0xa76e0e27afec7e7f51e19e195703da5216e0dfceda6724eb9de064ab1b4ce803 CHAIN=dst npx hardhat run scripts/withdraw-funds.ts
