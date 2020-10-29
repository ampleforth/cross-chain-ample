pragma solidity 0.6.4;

import "@openzeppelin/contracts/math/SafeMath.sol";

library Select {
    using SafeMath for uint256;

    function computeMedian(uint256[] memory array, uint256 size) internal pure returns (uint256) {
        require(size > 0 && array.length >= size);
        for (uint256 i = 1; i < size; i++) {
            for (uint256 j = i; j > 0 && array[j - 1] > array[j]; j--) {
                uint256 tmp = array[j];
                array[j] = array[j - 1];
                array[j - 1] = tmp;
            }
        }
        if (size % 2 == 1) {
            return array[size / 2];
        } else {
            return array[size / 2].add(array[size / 2 - 1]) / 2;
        }
    }
}
