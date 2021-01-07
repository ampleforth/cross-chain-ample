// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

interface IXCAmple {
    function globalAMPLSupply() external returns (uint256);

    function mint(address who, uint256 value) external;

    function burn(address who, uint256 value) external;

    function rebase(uint256 globalAmpleforthEpoch, uint256 globalAMPLSupply) external returns (uint256);
}
