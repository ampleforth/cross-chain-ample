// SPDX-License-Identifier: GPL-3.0-or-later

interface IBatchTxExecutor {
    function executeAll() external returns (bool);
}
