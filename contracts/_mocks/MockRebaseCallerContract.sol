// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.3;

import "../_interfaces/IXCAmpleController.sol";

contract MockRebaseCallerContract {
    function callRebase(address policy) public returns (bool) {
        // Take out a flash loan.
        // Do something funky...
        IXCAmpleController(policy).rebase(); // should fail
        // pay back flash loan.
        return true;
    }
}
