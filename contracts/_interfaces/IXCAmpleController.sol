// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

interface IXCAmpleController {
    function globalAmpleforthEpoch() external returns (uint256);

    function mint(address recipient, uint256 xcAmplAmount) external;

    function burn(address depositor, uint256 xcAmplAmount) external;

    function reportRebase(uint256 nextGlobalAmpleforthEpoch, uint256 nextGlobalAMPLSupply) external;
}
