// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.3;

contract MockXCAmpleController {
    event RebaseReport(uint256 epoch, uint256 totalSupply);
    event Mint(address who, uint256 value);
    event Burn(address who, uint256 value);

    uint256 public globalAmpleforthEpoch;

    function mint(address recipient, uint256 xcAmplAmount) external {
        emit Mint(recipient, xcAmplAmount);
    }

    function burn(address depositor, uint256 xcAmplAmount) external {
        emit Burn(depositor, xcAmplAmount);
    }

    function reportRebase(uint256 nextAMPLEpoch, uint256 nextGlobalAMPLSupply) external {
        emit RebaseReport(nextAMPLEpoch, nextGlobalAMPLSupply);
    }

    function updateAMPLEpoch(uint256 globalAmpleforthEpoch_) external {
        globalAmpleforthEpoch = globalAmpleforthEpoch_;
    }
}
