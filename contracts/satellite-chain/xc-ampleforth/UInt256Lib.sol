// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.3;

/**
 * @title Various utilities useful for uint256.
 * https://github.com/ampleforth/uFragments/blob/master/contracts/lib/UInt256Lib.sol
 */
library UInt256Lib {
    uint256 private constant MAX_INT256 = uint256(type(int256).max);

    /**
     * @dev Safely converts a uint256 to an int256.
     */
    function toInt256Safe(uint256 a) internal pure returns (int256) {
        require(a <= MAX_INT256, "UInt256Lib: int256 overflow");
        return int256(a);
    }
}
