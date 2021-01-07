pragma solidity 0.6.12;

contract MockXCAmple {
    event Rebase(uint256 globalEpoch, uint256 globalAMPLSupply);
    event Mint(address who, uint256 value);
    event Burn(address who, uint256 value);

    uint256 public totalSupply;
    uint256 public globalAMPLSupply;

    function updateTotalSupply(uint256 totalSupply_) external {
        totalSupply = totalSupply_;
    }

    function updateGlobalAMPLSupply(uint256 globalAMPLSupply_) external {
        globalAMPLSupply = globalAMPLSupply_;
    }

    function rebase(uint256 globalEpoch, uint256 globalAMPLSupply) external returns (uint256) {
        emit Rebase(globalEpoch, globalAMPLSupply);
    }

    function mint(address who, uint256 value) external {
        emit Mint(who, value);
    }

    function burn(address who, uint256 value) external {
        emit Burn(who, value);
    }
}
