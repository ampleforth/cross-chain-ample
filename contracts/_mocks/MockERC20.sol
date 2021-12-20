// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.3;

import "openzeppelin-contracts-3.4.1/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) public ERC20(name, symbol) {
        _mint(msg.sender, 50000 * 10**18);
    }
}
