// SPDX-License-Identifier: GPL-3.0-or-later
// Importing uFragments contract dependencies to be compiled for integration tests
pragma solidity 0.7.6;

import {UFragments} from "uFragments/contracts/UFragments.sol";

contract UFragmentsTestnet is UFragments {
    event Result(bool result, bytes reason);

    function isArbitrumEnabled() external view returns (uint8) {
        return uint8(0xa4b1);
    }

    // NOTE: this allows the token contarct to register itself with the bridge on testnet
    // The AMPL contract on mainnet is immutable and this can't be used!
    function externalCall(
        address destination,
        bytes calldata data,
        uint256 value
    ) external payable {
        (bool result, bytes memory reason) = destination.call{value: value}(data);
        emit Result(result, reason);
    }
}
