// SPDX-License-Identifier: GPL-3.0-or-later
import "ampleforth-contracts/contracts/interfaces/IAMPL.sol";

interface IXCAmple is IAMPL {
    function globalAMPLSupply() external view returns (uint256);

    function mint(address who, uint256 xcAmpleAmount) external;

    function burnFrom(address who, uint256 xcAmpleAmount) external;
}
