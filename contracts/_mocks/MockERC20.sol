pragma solidity 0.6.4;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name, string memory symbol) public ERC20(name, symbol) {
        _mint(msg.sender, 50000 * 10**18);
    }
}
