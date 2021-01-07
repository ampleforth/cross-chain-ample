pragma solidity 0.6.12;

library UInt256Lib {
    uint256 private constant MAX_INT256 = ~(uint256(1) << 255);

    function toInt256Safe(uint256 a) internal pure returns (int256) {
        require(a <= MAX_INT256);
        return int256(a);
    }
}
