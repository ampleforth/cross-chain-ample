pragma solidity 0.6.4;

contract MockXCAmpl {
    uint256 private _totalSupply;
    event MockRebase(uint256 epoch, uint256 totalSupply);
    event MockMint(address who, uint256 value);
    event MockBurn(address who, uint256 value);

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
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

    function updateTotalSupply(uint256 totalSupply_) external {
        _totalSupply = totalSupply_;
    }
}
