pragma solidity 0.6.4;

library SafeMathInt {
    int256 private constant MIN_INT256 = int256(1) << 255;

    function abs(int256 a) internal pure returns (int256) {
        require(a != MIN_INT256);
        return a < 0 ? -a : a;
    }
}
