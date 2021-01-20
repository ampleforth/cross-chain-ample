// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "./IAMPL.sol";

interface IXCAmple is IAMPL {
    function globalAMPLSupply() external view returns (uint256);
}
