// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@1inch/solidity-utils/contracts/libraries/SafeERC20.sol";
import {AddressLib, Address} from "@1inch/solidity-utils/contracts/libraries/AddressLib.sol";
import {Timelocks, TimelocksLib} from "./libraries/TimelocksLib.sol";
import {ImmutablesLib} from "./libraries/ImmutablesLib.sol";

import {Escrow} from "./Escrow.sol";
import {BaseEscrow} from "./BaseEscrow.sol";
import {IEscrowSrc} from "./interfaces/IEscrowSrc.sol";

contract EscrowSrc is Escrow, IEscrowSrc {
    using AddressLib for Address;
    using ImmutablesLib for Immutables;
    using SafeERC20 for IERC20;
    using TimelocksLib for Timelocks;

    constructor(uint32 rescueDelay) BaseEscrow(rescueDelay) {}

    /**
     * @notice Withdraw funds to taker with the correct secret.
     * @param secret The secret that unlocks the escrow.
     * @param immutables The immutable values used to deploy the clone contract.
     */
    function withdraw(
        bytes32 secret,
        Immutables calldata immutables
    )
        external
        onlyTaker(immutables)
        onlyAfter(immutables.timelocks.get(TimelocksLib.Stage.SrcWithdrawal))
        onlyBefore(immutables.timelocks.get(TimelocksLib.Stage.SrcCancellation))
    {
        _withdrawTo(secret, msg.sender, immutables);
    }

    /**
     * @notice Withdraw funds to a specified target.
     * @param secret The secret that unlocks the escrow.
     * @param target The address to transfer ERC20 tokens to.
     * @param immutables The immutable values used to deploy the clone contract.
     */
    function withdrawTo(
        bytes32 secret,
        address target,
        Immutables calldata immutables
    )
        external
        onlyTaker(immutables)
        onlyAfter(immutables.timelocks.get(TimelocksLib.Stage.SrcWithdrawal))
        onlyBefore(immutables.timelocks.get(TimelocksLib.Stage.SrcCancellation))
    {
        _withdrawTo(secret, target, immutables);
    }

    /**
     * @notice Public withdraw funds to taker with the correct secret during public period.
     * @param secret The secret that unlocks the escrow.
     * @param immutables The immutable values used to deploy the clone contract.
     */
    function publicWithdraw(
        bytes32 secret,
        Immutables calldata immutables
    )
        external
        onlyAfter(
            immutables.timelocks.get(TimelocksLib.Stage.SrcPublicWithdrawal)
        )
        onlyBefore(immutables.timelocks.get(TimelocksLib.Stage.SrcCancellation))
    {
        _withdrawTo(secret, immutables.taker.get(), immutables);
    }

    /**
     * @notice See {IBaseEscrow-cancel}.
     * @dev The function works on the time intervals highlighted with capital letters:
     * ---- contract deployed --/-- finality --/-- private withdrawal --/-- public withdrawal --/--
     * --/-- PRIVATE CANCELLATION --/-- PUBLIC CANCELLATION ----
     */
    function cancel(
        Immutables calldata immutables
    )
        external
        onlyTaker(immutables)
        onlyAfter(immutables.timelocks.get(TimelocksLib.Stage.SrcCancellation))
    {
        _cancel(immutables);
    }

    /**
     * @notice See {IEscrowSrc-publicCancel}.
     * @dev The function works on the time intervals highlighted with capital letters:
     * ---- contract deployed --/-- finality --/-- private withdrawal --/-- public withdrawal --/--
     * --/-- private cancellation --/-- PUBLIC CANCELLATION ----
     */
    function publicCancel(
        Immutables calldata immutables
    )
        external
        onlyAfter(
            immutables.timelocks.get(TimelocksLib.Stage.SrcPublicCancellation)
        )
    {
        _cancel(immutables);
    }

    /**
     * @dev Transfers tokens to the target and native tokens to the caller.
     */
    function _withdrawTo(
        bytes32 secret,
        address target,
        Immutables calldata immutables
    )
        internal
        onlyValidImmutables(immutables)
        onlyValidSecret(secret, immutables)
    {
        _uniTransfer(immutables.token.get(), target, immutables.amount);
        _ethTransfer(msg.sender, immutables.safetyDeposit);
        emit EscrowWithdrawal(secret);
    }

    /**
     * @dev Transfers ERC20 tokens to the maker and native tokens to the caller.
     * @param immutables The immutable values used to deploy the clone contract.
     */
    function _cancel(
        Immutables calldata immutables
    ) internal onlyValidImmutables(immutables) {
        IERC20(immutables.token.get()).safeTransfer(
            immutables.maker.get(),
            immutables.amount
        );
        _ethTransfer(msg.sender, immutables.safetyDeposit);
        emit EscrowCancelled();
    }
}
