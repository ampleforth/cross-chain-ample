// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.7.3;

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
