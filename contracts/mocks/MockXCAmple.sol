pragma solidity 0.6.4;

contract MockXCAmple {
    uint256 private _totalAMPLSupply;
    event LogRebase(uint256 epoch, uint256 totalSupply);
    event MintCalled(address who, uint256 value);
    event BurnCalled(address who, uint256 value);

    function totalAMPLSupply() public view returns (uint256) {
        return _totalAMPLSupply;
    }

    function rebase(uint256 epoch, uint256 totalAMPLSupply) external returns (uint256) {
        emit LogRebase(epoch, totalAMPLSupply);
    }

    function mint(address who, uint256 value) external {
        emit MintCalled(who, value);
    }

    function burn(address who, uint256 value) external {
        emit BurnCalled(who, value);
    }

    function updateTotalSupply(uint256 totalAMPLSupply) external {
        _totalAMPLSupply = totalAMPLSupply;
    }
}
