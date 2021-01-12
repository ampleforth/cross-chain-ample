// SPDX-License-Identifier: GPL-3.0-or-later
pragma solidity 0.6.12;

import {SafeMath} from "@openzeppelin/contracts/math/SafeMath.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title BatchTxExecutor
 * @notice Utility that executes transactions in the provided white-list serially.
 *         Stable ordering of execution is not guaranteed.
 */
contract BatchTxExecutor is Ownable {
    using SafeMath for uint256;

    struct Transaction {
        bool enabled;
        address destination;
        bytes data;
    }

    event TransactionFailed(address indexed destination, uint256 index, bytes data, bytes reason);

    Transaction[] public transactions;

    /**
     * @notice Executes all transactions marked enabled.
     *         If any transaction in the transaction list reverts, it breaks execution
     *         and returns false.
     */
    function executeAll() external returns (bool) {
        for (uint256 i = 0; i < transactions.length; i++) {
            Transaction storage t = transactions[i];
            if (t.enabled) {
                (bool result, bytes memory reason) = t.destination.call(t.data);
                if (!result) {
                    emit TransactionFailed(t.destination, i, t.data, reason);
                    return false;
                }
            }
        }

        return true;
    }

    /**
     * @notice Adds a transaction to the transaction list
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
        require(index < transactions.length, "BatchTxExecutor: index out of bounds");

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
        require(
            index < transactions.length,
            "BatchTxExecutor: index must be in range of stored tx list"
        );
        transactions[index].enabled = enabled;
    }

    /**
     * @return Number of transactions, both enabled and disabled, in transactions list.
     */
    function transactionsSize() external view returns (uint256) {
        return transactions.length;
    }
}
