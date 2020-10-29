pragma solidity 0.6.4;

contract MockVault {
    event MockLock(address who, uint256 value);
    event MockUnlock(address who, uint256 value);

    function lock(address depositor, uint256 amount) external {
        emit MockLock(depositor, amount);
    }

    function unlock(address recipient, uint256 amount) external {
        emit MockUnlock(recipient, amount);
    }
}
