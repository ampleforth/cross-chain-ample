pragma solidity 0.6.4;

contract MockRebaseRelayer {
    uint256 private state;

    function executeAll() external view returns (bool) {
        if (state == 0) {
            return false;
        }

        if (state == 1) {
            require(false);
        }

        return true;
    }

    function updateSuccessState(uint256 state_) external {
        state = state_;
    }
}
