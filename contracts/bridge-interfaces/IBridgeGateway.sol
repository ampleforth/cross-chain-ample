// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

/*
    INTERFACE NAMING CONVENTION:

    Base Chain: Ethereum; chain where actual AMPL tokens are locked/unlocked
    Satellite Chain: (tron, acala, ..); chain where xc-ample tokens are mint/burnt

    Source chain: Chain where a cross-chain transaction is initiated. (any chain ethereum, tron, acala ...)
    Target chain: Chain where a cross-chain transaction is finalized. (any chain ethereum, tron, acala ...)

    If a variable is prefixed with recorded: It refers to the existing value on the current-chain.
    eg) When rebase is reported to tron through a bridge, globalAMPLSupply is the new value
    reported through the bridge and recordedGlobalAMPLSupply refers to the current value on tron.

    On the Base chain:
    * ampl.totalSupply is the globalAMPLSupply.

    On Satellite chains:
    * xcAmple.totalSupply returns the current supply of xc-amples in circulation
    * xcAmple.globalAMPLSupply returns the chain's copy of the base chain's globalAMPLSupply.
*/

interface IBridgeGateway {
    // Logged on the base chain gateway (ethereum) when rebase report is propagated out
    event XCRebaseReportOut(
        uint256 globalAmpleforthEpoch, // epoch from the Ampleforth Monetary Policy on the base chain
        uint256 globalAMPLSupply // totalSupply of AMPL ERC-20 contract on the base chain
    );

    // Logged on the satellite chain gateway (tron, acala, near) when bridge reports most recent rebase
    event XCRebaseReportIn(
        uint256 globalAmpleforthEpoch, // new value coming in from the base chain
        uint256 globalAMPLSupply, // new value coming in from the base chain
        uint256 recordedGlobalAmpleforthEpoch, // existing value on the satellite chain
        uint256 recordedGlobalAMPLSupply // existing value on the satellite chain
    );

    // Logged on source chain when cross-chain transfer is initiated
    event XCTransferOut(
        address sender, // user sending funds
        uint256 amount, // amount to be locked/burnt
        uint256 recordedGlobalAMPLSupply // existing value on the current source chain
    );

    // Logged on target chain when cross-chain transfer is completed
    event XCTransferIn(
        address recipient, // user receiving funds
        uint256 globalAMPLSupply, // value on remote chain when transaction was initiated
        uint256 amount, // amount to be unlocked/mint
        uint256 recordedGlobalAMPLSupply // existing value on the current target chain
    );
}
