pragma solidity 0.6.4;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title XCOrchestrator
 * @notice The xc-orchestrator coordinates the xc-controller actions with external consumers.
 *         The `executePostRebaseCallbacks` method is invoked by the XCAmpleforthController
 *         at the end of the rebase function to notify the rebase event to a white-list of consumers.
 */
contract XCOrchestrator is Ownable {
    using SafeMath for uint256;

    struct Transaction {
        bool enabled;
        address destination;
        bytes data;
    }

    event TransactionFailed(address indexed destination, uint256 index, bytes data);

    // Stable ordering is not guaranteed.
    Transaction[] public transactions;

    /**
     * @notice The Orchestrator notifies downstream applications.
     *         If any transaction in the transaction list reverts, it breaks execution
     *         and returns false.
     */
    function executePostRebaseCallbacks() external returns (bool) {
        for (uint256 i = 0; i < transactions.length; i++) {
            Transaction storage t = transactions[i];
            if (t.enabled) {
                (bool result, ) = t.destination.call(t.data);
                if (!result) {
                    emit TransactionFailed(t.destination, i, t.data);
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * @notice Adds a transaction that gets called for a downstream receiver of rebases
     * @param destination Address of contract destination
     * @param data Transaction data payload
     */
    function addTransaction(address destination, bytes calldata data) external onlyOwner {
        transactions.push(Transaction({enabled: true, destination: destination, data: data}));
    }

    /**
     * @param index Index of transaction to remove.
     *              Transaction ordering may have changed since adding.
     */
    function removeTransaction(uint256 index) external onlyOwner {
        require(index < transactions.length, "index out of bounds");

        if (index < transactions.length - 1) {
            transactions[index] = transactions[transactions.length - 1];
        }

        transactions.pop();
    }

    /**
     * @param index Index of transaction. Transaction ordering may have changed since adding.
     * @param enabled True for enabled, false for disabled.
     */
    function setTransactionEnabled(uint256 index, bool enabled) external onlyOwner {
        require(index < transactions.length, "index must be in range of stored tx list");
        transactions[index].enabled = enabled;
    }

    /**
     * @return Number of transactions, both enabled and disabled, in transactions list.
     */
    function transactionsSize() external view returns (uint256) {
        return transactions.length;
    }
}
