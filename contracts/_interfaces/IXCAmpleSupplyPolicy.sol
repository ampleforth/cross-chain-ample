// SPDX-License-Identifier: GPL-3.0-or-later

interface IXCAmpleSupplyPolicy {
    function rebase(uint256 globalAmpleforthEpoch_, uint256 globalAMPLSupply_)
        external
        returns (uint256);

    function mint(address who, uint256 value) external;

    function burn(address who, uint256 value) external;
}
