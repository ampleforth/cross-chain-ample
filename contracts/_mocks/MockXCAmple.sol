// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.3;

contract MockXCAmple {
    event Rebase(uint256 globalEpoch, uint256 globalAMPLSupply_);
    event Mint(address who, uint256 value);
    event Burn(address who, uint256 value);

    uint256 public totalSupply;
    uint256 public globalAMPLSupply;

    function updateTotalSupply(uint256 totalSupply_) external {
        totalSupply = totalSupply_;
    }

    function updateGlobalAMPLSupply(uint256 globalAMPLSupply_) external {
        globalAMPLSupply = globalAMPLSupply_;
    }

    function rebase(uint256 globalEpoch, uint256 globalAMPLSupply_) external returns (uint256) {
        globalAMPLSupply = globalAMPLSupply_;
        emit Rebase(globalEpoch, globalAMPLSupply_);
    }

    function mint(address who, uint256 value) external {
        emit Mint(who, value);
    }

    function burnFrom(address who, uint256 value) external {
        emit Burn(who, value);
    }
}
