// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

interface ITokenVault {
    function lock(
        address token,
        address depositor,
        uint256 amount
    ) external;

    function unlock(
        address token,
        address recipient,
        uint256 amount
    ) external;
}
