pragma solidity 0.6.12;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IUFragmentsPolicy {
    function rebase() external;
}

contract Orchestrator is Ownable {
    using SafeMath for uint256;

    struct Transaction {
        bool enabled;
        address destination;
        bytes data;
    }

    event TransactionFailed(address indexed destination, uint256 index, bytes data);

    Transaction[] public transactions;

    IUFragmentsPolicy public policy;

    constructor(address policy_) public {
        policy = IUFragmentsPolicy(policy_);
    }

    function rebase() external {
        require(msg.sender == tx.origin); // solhint-disable-line avoid-tx-origin

        policy.rebase();

        for (uint256 i = 0; i < transactions.length; i++) {
            Transaction storage t = transactions[i];
            if (t.enabled) {
                bool result = externalCall(t.destination, t.data);
                if (!result) {
                    emit TransactionFailed(t.destination, i, t.data);
                    revert("Transaction Failed");
                }
            }
        }
    }

    function addTransaction(address destination, bytes calldata data) external onlyOwner {
        transactions.push(Transaction({enabled: true, destination: destination, data: data}));
    }

    function removeTransaction(uint256 index) external onlyOwner {
        require(index < transactions.length, "index out of bounds");

        if (index < transactions.length - 1) {
            transactions[index] = transactions[transactions.length - 1];
        }

        delete transactions[transactions.length - 1];
    }

    function setTransactionEnabled(uint256 index, bool enabled) external onlyOwner {
        require(index < transactions.length, "index must be in range of stored tx list");
        transactions[index].enabled = enabled;
    }

    function transactionsSize() external view returns (uint256) {
        return transactions.length;
    }

    function externalCall(address destination, bytes memory data) internal returns (bool) {
        bool result;

        // 34710 is the value that solidity is currently emitting
        // It includes callGas (700) + callVeryLow (3, to pay for SUB)
        // + callValueTransferGas (9000) + callNewAccountGas
        // (25000, in case the destination address does not exist and needs creating)
        uint256 gasLeft = gasleft().sub(34710);

        assembly {
            // solhint-disable-line no-inline-assembly
            // "Allocate" memory for output
            // (0x40 is where "free memory" pointer is stored by convention)
            let outputAddress := mload(0x40)

            // First 32 bytes are the padded length of data, so exclude that
            let dataAddress := add(data, 32)

            result := call(
                gasLeft,
                destination,
                0, // transfer value in wei
                dataAddress,
                mload(data), // Size of the input, in bytes. Stored in position 0 of the array.
                outputAddress,
                0 // Output is ignored, therefore the output size is zero
            )
        }
        return result;
    }
}
