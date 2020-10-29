pragma solidity 0.6.4;

contract MockAmpl {
    uint256 public totalSupply;

    function updateTotalSupply(uint256 totalSupply_) external {
        totalSupply = totalSupply_;
    }
}
