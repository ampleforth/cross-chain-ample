// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

interface IXCAmpleController {
    function rebase() external;

    function lastRebaseTimestampSec() external view returns (uint256);

    function globalAmpleforthEpoch() external view returns (uint256);

    function globalAmpleforthEpochAndAMPLSupply() external view returns (uint256, uint256);
}
