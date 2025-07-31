// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@1inch/solidity-utils/contracts/libraries/SafeERC20.sol";
import {AddressLib, Address} from "@1inch/solidity-utils/contracts/libraries/AddressLib.sol";
import {Timelocks, TimelocksLib} from "./libraries/TimelocksLib.sol";

import {Escrow} from "./Escrow.sol";
import {BaseEscrow} from "./BaseEscrow.sol";
import {IEscrowDst} from "./interfaces/IEscrowDst.sol";

contract EscrowDst is Escrow, IEscrowDst {
    using SafeERC20 for IERC20;
    using AddressLib for Address;
    using TimelocksLib for Timelocks;

    constructor(uint32 rescueDelay) BaseEscrow(rescueDelay) {}

    /**
     * @notice Withdraw funds to maker with the correct secret.
     * @param secret The secret that unlocks the escrow.
     * @param immutables The immutable values used to deploy the clone contract.
     */
    function withdraw(
        bytes32 secret,
        Immutables calldata immutables
    )
        external
        onlyTaker(immutables)
        onlyAfter(immutables.timelocks.get(TimelocksLib.Stage.DstWithdrawal))
        onlyBefore(immutables.timelocks.get(TimelocksLib.Stage.DstCancellation))
    {
        _withdraw(secret, immutables);
    }

    /**
     * @notice See {IBaseEscrow-publicWithdraw}.
     * @dev The function works on the time intervals highlighted with capital letters:
     * ---- contract deployed --/-- finality --/-- private withdrawal --/-- PUBLIC WITHDRAWAL --/-- private cancellation ----
     */
    function publicWithdraw(
        bytes32 secret,
        Immutables calldata immutables
    )
        external
        onlyAfter(
            immutables.timelocks.get(TimelocksLib.Stage.DstPublicWithdrawal)
        )
        onlyBefore(immutables.timelocks.get(TimelocksLib.Stage.DstCancellation))
    {
        _withdraw(secret, immutables);
    }

    /**
     * @notice See {IBaseEscrow-cancel}.
     * @dev The function works on the time interval highlighted with capital letters:
     * ---- contract deployed --/-- finality --/-- private withdrawal --/-- public withdrawal --/-- PRIVATE CANCELLATION ----
     */
    function cancel(
        Immutables calldata immutables
    )
        external
        onlyTaker(immutables)
        onlyValidImmutables(immutables)
        onlyAfter(immutables.timelocks.get(TimelocksLib.Stage.DstCancellation))
    {
        _uniTransfer(
            immutables.token.get(),
            immutables.taker.get(),
            immutables.amount
        );
        _ethTransfer(msg.sender, immutables.safetyDeposit);
        emit EscrowCancelled();
    }

    /**
     * @dev Transfers tokens to the maker and native tokens to the caller.
     */
    function _withdraw(
        bytes32 secret,
        Immutables calldata immutables
    )
        internal
        onlyValidImmutables(immutables)
        onlyValidSecret(secret, immutables)
    {
        _uniTransfer(
            immutables.token.get(),
            immutables.maker.get(),
            immutables.amount
        );
        _ethTransfer(msg.sender, immutables.safetyDeposit);
        emit EscrowWithdrawal(secret);
    }
}
