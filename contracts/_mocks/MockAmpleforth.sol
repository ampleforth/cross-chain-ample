// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

contract MockAmpleforth {
    uint256 public epoch;

    function updateEpoch(uint256 epoch_) external {
        epoch = epoch_;
    }
}
