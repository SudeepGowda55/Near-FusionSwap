// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import {Clones} from "@openzeppelin/contracts/proxy/Clones.sol";
import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@1inch/solidity-utils/contracts/libraries/SafeERC20.sol";
import {Address, AddressLib} from "@1inch/solidity-utils/contracts/libraries/AddressLib.sol";
import {Timelocks, TimelocksLib} from "./libraries/TimelocksLib.sol";
import {ImmutablesLib} from "./libraries/ImmutablesLib.sol";
import {ProxyHashLib} from "./libraries/ProxyHashLib.sol";

import {EscrowSrc} from "./EscrowSrc.sol";
import {EscrowDst} from "./EscrowDst.sol";
import {IBaseEscrow} from "./interfaces/IBaseEscrow.sol";
import {IEscrowFactory} from "./interfaces/IEscrowFactory.sol";

contract EscrowFactory is IEscrowFactory {
    using AddressLib for Address;
    using ImmutablesLib for IBaseEscrow.Immutables;
    using TimelocksLib for Timelocks;
    using SafeERC20 for IERC20;
    using Clones for address;

    /// @notice Implementation contract for source chain escrows.
    address public immutable ESCROW_SRC_IMPLEMENTATION;
    /// @notice Implementation contract for destination chain escrows.
    address public immutable ESCROW_DST_IMPLEMENTATION;
    bytes32 internal immutable _PROXY_SRC_BYTECODE_HASH;
    bytes32 internal immutable _PROXY_DST_BYTECODE_HASH;

    constructor(uint32 rescueDelaySrc, uint32 rescueDelayDst) {
        ESCROW_SRC_IMPLEMENTATION = address(new EscrowSrc(rescueDelaySrc));
        ESCROW_DST_IMPLEMENTATION = address(new EscrowDst(rescueDelayDst));

        // Compute bytecode hashes using ProxyHashLib (like 1inch)
        _PROXY_SRC_BYTECODE_HASH = ProxyHashLib.computeProxyBytecodeHash(
            ESCROW_SRC_IMPLEMENTATION
        );
        _PROXY_DST_BYTECODE_HASH = ProxyHashLib.computeProxyBytecodeHash(
            ESCROW_DST_IMPLEMENTATION
        );
    }

    /**
     * @notice Returns the deterministic address of the source escrow.
     * @param immutables The immutable arguments used to compute salt for escrow deployment.
     * @return The computed address of the escrow.
     */
    function addressOfEscrowSrc(
        IBaseEscrow.Immutables calldata immutables
    ) external view returns (address) {
        return
            Create2.computeAddress(immutables.hash(), _PROXY_SRC_BYTECODE_HASH);
    }

    /**
     * @notice Returns the deterministic address of the destination escrow.
     * @param immutables The immutable arguments used to compute salt for escrow deployment.
     * @return The computed address of the escrow.
     */
    function addressOfEscrowDst(
        IBaseEscrow.Immutables calldata immutables
    ) external view returns (address) {
        return
            Create2.computeAddress(immutables.hash(), _PROXY_DST_BYTECODE_HASH);
    }

    /**
     * @notice Deploys a new escrow contract.
     * @param salt The salt for the deterministic address computation.
     * @param value The value to be sent to the escrow contract.
     * @param implementation Address of the implementation.
     * @return escrow The address of the deployed escrow contract.
     */
    function _deployEscrow(
        bytes32 salt,
        uint256 value,
        address implementation
    ) internal returns (address escrow) {
        escrow = implementation.cloneDeterministic(salt, value);
    }

    function _isValidPartialFill(
        uint256 makingAmount,
        uint256 remainingMakingAmount,
        uint256 orderMakingAmount,
        uint256 partsAmount,
        uint256 validatedIndex
    ) internal pure returns (bool) {
        uint256 calculatedIndex = ((orderMakingAmount -
            remainingMakingAmount +
            makingAmount -
            1) * partsAmount) / orderMakingAmount;

        if (remainingMakingAmount == makingAmount) {
            // The last secret must be used for the last fill.
            return (calculatedIndex + 2 == validatedIndex);
        } else if (orderMakingAmount != remainingMakingAmount) {
            // Calculate the previous fill index only if this is not the first fill.
            uint256 prevCalculatedIndex = ((orderMakingAmount -
                remainingMakingAmount -
                1) * partsAmount) / orderMakingAmount;
            if (calculatedIndex == prevCalculatedIndex) return false;
        }

        return calculatedIndex + 1 == validatedIndex;
    }

    /**
     * @notice Creates a new escrow contract for the source chain.
     * @param srcImmutables The immutables of the escrow contract.
     */
    function createSrcEscrow(
        IBaseEscrow.Immutables calldata srcImmutables
    ) external payable {
        address token = srcImmutables.token.get();
        uint256 nativeAmount = srcImmutables.safetyDeposit;
        if (token == address(0)) {
            nativeAmount += srcImmutables.amount;
        }
        if (msg.value != nativeAmount) revert InsufficientEscrowBalance();

        // copy calldata immutables into memory and set deployed timestamp
        IBaseEscrow.Immutables memory immutables = srcImmutables;
        immutables.timelocks = immutables.timelocks.setDeployedAt(
            block.timestamp
        );

        bytes32 salt = immutables.hashMem();
        address escrow = _deployEscrow(
            salt,
            msg.value,
            ESCROW_SRC_IMPLEMENTATION
        );

        if (token != address(0)) {
            IERC20(token).safeTransferFrom(
                msg.sender,
                escrow,
                immutables.amount
            );
        }

        // Build the complement for destination immutables to emit in the event
        IEscrowFactory.DstImmutablesComplement
            memory dstComplement = IEscrowFactory.DstImmutablesComplement({
                maker: srcImmutables.maker,
                amount: srcImmutables.amount,
                token: srcImmutables.token,
                safetyDeposit: srcImmutables.safetyDeposit,
                chainId: block.chainid
            });
        emit SrcEscrowCreated(immutables, dstComplement);
    }

    /**
     * @notice Creates a new escrow contract for the destination chain.
     * @param dstImmutables The immutables of the escrow contract.
     * @param srcCancellationTimestamp The start of the cancellation period for the source chain.
     */
    function createDstEscrow(
        IBaseEscrow.Immutables calldata dstImmutables,
        uint256 srcCancellationTimestamp
    ) external payable {
        address token = dstImmutables.token.get();
        uint256 nativeAmount = dstImmutables.safetyDeposit;
        if (token == address(0)) {
            nativeAmount += dstImmutables.amount;
        }
        if (msg.value != nativeAmount) revert InsufficientEscrowBalance();

        IBaseEscrow.Immutables memory immutables = dstImmutables;
        immutables.timelocks = immutables.timelocks.setDeployedAt(
            block.timestamp
        );

        // Check that the escrow cancellation will start not later than the cancellation time on the source chain.
        if (
            immutables.timelocks.get(TimelocksLib.Stage.DstCancellation) >
            srcCancellationTimestamp
        ) revert InvalidCreationTime();

        bytes32 salt = immutables.hashMem();
        address escrow = _deployEscrow(
            salt,
            msg.value,
            ESCROW_DST_IMPLEMENTATION
        );

        if (token != address(0)) {
            IERC20(token).safeTransferFrom(
                msg.sender,
                escrow,
                immutables.amount
            );
        }

        emit DstEscrowCreated(
            escrow,
            dstImmutables.hashlock,
            dstImmutables.taker
        );
    }
}
