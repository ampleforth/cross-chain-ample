pragma solidity 0.6.4;

contract MockXCAmpl {
    event MockRebase(uint256 epoch, uint256 totalSupply);
    event MockMint(address who, uint256 value);
    event MockBurn(address who, uint256 value);

    uint256 public totalSupply;
    uint256 public totalAMPLSupply;

    function updateTotalSupply(uint256 totalSupply_) external {
        totalSupply = totalSupply_;
    }

    function updateTotalAMPLSupply(uint256 totalAMPLSupply_) external {
        totalAMPLSupply = totalAMPLSupply_;
    }

    function rebase(uint256 epoch, uint256 totalSupply_) external returns (uint256) {
        emit MockRebase(epoch, totalSupply_);
    }

    function mint(address who, uint256 value) external {
        emit MockMint(who, value);
    }

    function burn(address who, uint256 value) external {
        emit MockBurn(who, value);
    }
}
