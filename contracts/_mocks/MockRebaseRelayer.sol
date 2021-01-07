pragma solidity 0.6.12;

contract MockRebaseRelayer {
    enum State {Failure, Revert, Success}
    State private state;

    function executeAll() external view returns (bool) {
        if (state == State.Failure) {
            return false;
        }

        if (state == State.Revert) {
            require(false);
        }

        if (state == State.Success) {
            return true;
        }
    }

    function updateSuccessState(State state_) external {
        state = state_;
    }
}
