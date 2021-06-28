## INTERFACE NAMING CONVENTION:

**Base Chain:** Ethereum; chain where actual AMPL tokens are locked/unlocked
**Satellite Chain:** (ethereum layer 2 or compatible EVM chain);
                 chain where xc-ample tokens are mint/burnt

**Source chain:** Chain where a cross-chain transaction is initiated. (any chain ethereum, matic, optimism)
**Target chain:** Chain where a cross-chain transaction is finalized. (any chain ethereum, matic, optimism)

If a variable is prefixed with `recorded`: It refers to the existing value on the current-chain.
eg) When rebase is reported to matic through a bridge, globalAMPLSupply is the new value
reported through the bridge and recordedGlobalAMPLSupply refers to the current value on matic.

On the Base chain:
* ampl.totalSupply is the globalAMPLSupply.

On Satellite chains:
* xcAmple.totalSupply returns the current supply of xc-amples in circulation
* xcAmple.globalAMPLSupply returns the chain's copy of the base chain's globalAMPLSupply.
