// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import "../_interfaces/IXCAmpleController.sol";

contract MockConstructorRebaseCallerContract {
    constructor(address policy) public {
        // Take out a flash loan.
        // Do something funky...
        IXCAmpleController(policy).rebase(); // should fail
        // pay back flash loan.
    }
}
