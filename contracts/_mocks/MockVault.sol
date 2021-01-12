// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

contract MockVault {
    event Lock(address token, address who, uint256 value);
    event Unlock(address token, address who, uint256 value);

    function lock(
        address token,
        address depositor,
        uint256 amount
    ) external {
        emit Lock(token, depositor, amount);
    }

    function unlock(
        address token,
        address recipient,
        uint256 amount
    ) external {
        emit Unlock(token, recipient, amount);
    }
}
