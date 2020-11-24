pragma solidity 0.6.4;

contract MockXCAmple {
    uint256 private _totalSupply;
    event LogRebase(uint256 epoch, uint256 totalSupply);
    event MintCalled(address who, uint256 value);
    event BurnCalled(address who, uint256 value);

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function rebase(uint256 epoch, uint256 totalSupply_) external returns (uint256) {
        emit LogRebase(epoch, totalSupply_);
    }

    function mint(address who, uint256 value) external {
        emit MintCalled(who, value);
    }

    function burn(address who, uint256 value) external {
        emit BurnCalled(who, value);
    }

    function updateTotalSupply(uint256 totalSupply_) external {
        _totalSupply = totalSupply_;
    }
}
