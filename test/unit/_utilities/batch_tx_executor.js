const { ethers } = require('hardhat');
const { expect } = require('chai');

let accounts, deployer, user, batchExecutor, mockDownstream, r;
async function setupContracts () {
  // prepare signers
  accounts = await ethers.getSigners();
  deployer = accounts[0];
  user = accounts[1];

  batchExecutor = await (
    await ethers.getContractFactory(
      'contracts/_utilities/BatchTxExecutor.sol:BatchTxExecutor',
    )
  )
    .connect(deployer)
    .deploy();

  mockDownstream = await (await ethers.getContractFactory('MockDownstream'))
    .connect(deployer)
    .deploy();
}

describe('BatchTxExecutor', function () {
  beforeEach('setup BatchTxExecutor contract', setupContracts);

  describe('when sent ether', async function () {
    it('should reject', async function () {
      await expect(
        user.sendTransaction({ to: batchExecutor.address, value: 1 }),
      ).to.be.reverted;
    });
  });

  describe('when transaction list is empty', async function () {
    beforeEach('calling executeAll', async function () {
      await expect(await batchExecutor.callStatic.executeAll()).to.be.true;
      r = batchExecutor.executeAll();
    });

    it('should have no transactions', async function () {
      expect(await batchExecutor.transactionsSize()).to.eq(0);
    });

    it('should not have any subsequent logs', async function () {
      expect((await (await r).wait()).logs.length).to.eq(0);
    });
  });

  describe('when there is a single transaction', async function () {
    beforeEach('adding a transaction', async function () {
      const updateOneArgEncoded = await mockDownstream.populateTransaction.updateOneArg(
        12345,
      );
      await batchExecutor
        .connect(deployer)
        .addTransaction(mockDownstream.address, 0, updateOneArgEncoded.data);
      await expect(await batchExecutor.callStatic.executeAll()).to.be.true;
      r = batchExecutor.connect(deployer).executeAll();
    });

    it('should have 1 transaction', async function () {
      expect(await batchExecutor.transactionsSize()).to.eq(1);
    });

    it('should call the transaction', async function () {
      await expect(r)
        .to.emit(mockDownstream, 'FunctionCalled')
        .withArgs('MockDownstream', 'updateOneArg', batchExecutor.address);

      await expect(r)
        .to.emit(mockDownstream, 'FunctionArguments')
        .withArgs([12345], []);
    });

    it('should not have any subsequent logs', async function () {
      expect((await (await r).wait()).logs.length).to.eq(2);
    });
  });

  describe('when there are two transactions', async function () {
    beforeEach('adding 2 transactions', async function () {
      const updateOneArgEncoded = await mockDownstream.populateTransaction.updateOneArg(
        12345,
      );
      await batchExecutor
        .connect(deployer)
        .addTransaction(mockDownstream.address, 0, updateOneArgEncoded.data);

      const updateTwoArgsEncoded = await mockDownstream.populateTransaction.updateTwoArgs(
        12345,
        23456,
      );
      await batchExecutor
        .connect(deployer)
        .addTransaction(mockDownstream.address, 0, updateTwoArgsEncoded.data);
      await expect(await batchExecutor.callStatic.executeAll()).to.be.true;
      r = batchExecutor.connect(deployer).executeAll();
    });

    it('should have 2 transactions', async function () {
      expect(await batchExecutor.transactionsSize()).to.eq(2);
    });

    it('should call first transaction', async function () {
      await expect(r)
        .to.emit(mockDownstream, 'FunctionCalled')
        .withArgs('MockDownstream', 'updateOneArg', batchExecutor.address);

      await expect(r)
        .to.emit(mockDownstream, 'FunctionArguments')
        .withArgs([12345], []);
    });

    it('should call second transaction', async function () {
      await expect(r)
        .to.emit(mockDownstream, 'FunctionCalled')
        .withArgs('MockDownstream', 'updateTwoArgs', batchExecutor.address);

      await expect(r)
        .to.emit(mockDownstream, 'FunctionArguments')
        .withArgs([12345], [23456]);
    });

    it('should not have any subsequent logs', async function () {
      expect((await (await r).wait()).logs.length).to.eq(4);
    });
  });

  describe('when there a transaction with non zero value', async function () {
    beforeEach('adding a transaction', async function () {
      const updateWithValueEncoded = await mockDownstream.populateTransaction.updateWithValue(
        '1000000000000000000',
      );

      await batchExecutor
        .connect(deployer)
        .addTransaction(
          mockDownstream.address,
          '1000000000000000000',
          updateWithValueEncoded.data,
        );

      await expect(
        await batchExecutor.callStatic.checkExecution(0, {
          value: '1000000000000000000'
        }),
      ).to.be.true;
      await expect(
        await batchExecutor.callStatic.executeAll({
          value: '1000000000000000000'
        }),
      ).to.be.true;
      r = batchExecutor
        .connect(deployer)
        .executeAll({ value: '1000000000000000000' });
    });

    it('should call the transaction', async function () {
      await expect(r)
        .to.emit(mockDownstream, 'FunctionCalled')
        .withArgs('MockDownstream', 'updateWithValue', batchExecutor.address);

      await expect(r)
        .to.emit(mockDownstream, 'FunctionArguments')
        .withArgs(['1000000000000000000'], []);
    });

    it('should transfer eth', async function () {
      expect(await ethers.provider.getBalance(mockDownstream.address)).to.eq(
        '1000000000000000000',
      );
    });
  });

  describe('when 1st out of 2 is disabled', async function () {
    beforeEach('disabling a transaction', async function () {
      const updateOneArgEncoded = await mockDownstream.populateTransaction.updateOneArg(
        12345,
      );
      await batchExecutor
        .connect(deployer)
        .addTransaction(mockDownstream.address, 0, updateOneArgEncoded.data);

      const updateTwoArgsEncoded = await mockDownstream.populateTransaction.updateTwoArgs(
        12345,
        23456,
      );
      await batchExecutor
        .connect(deployer)
        .addTransaction(mockDownstream.address, 0, updateTwoArgsEncoded.data);

      await batchExecutor.connect(deployer).setTransactionEnabled(0, false);
      await expect(await batchExecutor.callStatic.executeAll()).to.be.true;
      r = batchExecutor.connect(deployer).executeAll();
    });

    it('should have 2 transactions', async function () {
      expect(await batchExecutor.transactionsSize()).to.eq(2);
    });

    it('should call second transaction', async function () {
      await expect(r)
        .to.emit(mockDownstream, 'FunctionCalled')
        .withArgs('MockDownstream', 'updateTwoArgs', batchExecutor.address);

      await expect(r)
        .to.emit(mockDownstream, 'FunctionArguments')
        .withArgs([12345], [23456]);
    });

    it('should not have any subsequent logs', async function () {
      expect(await (await (await r).wait()).logs.length).to.eq(2);
    });
  });

  describe('when 1st out of 2 is removed', async function () {
    beforeEach('removing 1st transaction', async function () {
      const updateOneArgEncoded = await mockDownstream.populateTransaction.updateOneArg(
        12345,
      );
      await batchExecutor
        .connect(deployer)
        .addTransaction(mockDownstream.address, 0, updateOneArgEncoded.data);

      const updateTwoArgsEncoded = await mockDownstream.populateTransaction.updateTwoArgs(
        12345,
        23456,
      );
      await batchExecutor
        .connect(deployer)
        .addTransaction(mockDownstream.address, 0, updateTwoArgsEncoded.data);

      await batchExecutor.connect(deployer).removeTransaction(0);
      await expect(await batchExecutor.callStatic.executeAll()).to.be.true;
      r = batchExecutor.connect(deployer).executeAll();
    });

    it('should have 1 transaction', async function () {
      expect(await batchExecutor.transactionsSize()).to.eq(1);
    });

    it('should call the transaction', async function () {
      await expect(r)
        .to.emit(mockDownstream, 'FunctionCalled')
        .withArgs('MockDownstream', 'updateTwoArgs', batchExecutor.address);

      await expect(r)
        .to.emit(mockDownstream, 'FunctionArguments')
        .withArgs([12345], [23456]);
    });

    it('should not have any subsequent logs', async function () {
      expect((await (await r).wait()).logs.length).to.eq(2);
    });
  });

  describe('when all transactions are removed', async function () {
    beforeEach('removing 2 tx', async function () {
      const updateOneArgEncoded = await mockDownstream.populateTransaction.updateOneArg(
        12345,
      );
      await batchExecutor
        .connect(deployer)
        .addTransaction(mockDownstream.address, 0, updateOneArgEncoded.data);

      const updateTwoArgsEncoded = await mockDownstream.populateTransaction.updateTwoArgs(
        12345,
        23456,
      );
      await batchExecutor
        .connect(deployer)
        .addTransaction(mockDownstream.address, 0, updateTwoArgsEncoded.data);

      await batchExecutor.connect(deployer).removeTransaction(0);
      await batchExecutor.connect(deployer).removeTransaction(0);

      await expect(await batchExecutor.callStatic.executeAll()).to.be.true;
      r = batchExecutor.connect(deployer).executeAll();
    });

    it('should have 0 transactions', async function () {
      expect(await batchExecutor.transactionsSize()).to.eq(0);
    });

    it('should not have any subsequent logs', async function () {
      expect((await (await r).wait()).logs.length).to.eq(0);
    });
  });

  describe('when a transaction reverts', async function () {
    beforeEach('adding 3 transactions', async function () {
      const updateOneArgEncoded = await mockDownstream.populateTransaction.updateOneArg(
        123,
      );
      await batchExecutor
        .connect(deployer)
        .addTransaction(mockDownstream.address, 0, updateOneArgEncoded.data);

      const revertsEncoded = await mockDownstream.populateTransaction.reverts();
      await batchExecutor
        .connect(deployer)
        .addTransaction(mockDownstream.address, 0, revertsEncoded.data);

      const updateTwoArgsEncoded = await mockDownstream.populateTransaction.updateTwoArgs(
        12345,
        23456,
      );
      await batchExecutor
        .connect(deployer)
        .addTransaction(mockDownstream.address, 0, updateTwoArgsEncoded.data);
    });

    it('should NOT revert', async function () {
      await expect(await batchExecutor.callStatic.executeAll()).to.be.false;
      const call = await mockDownstream.populateTransaction.reverts();
      const revertReasonBytes =
        '0x08c379a0000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000087265766572746564000000000000000000000000000000000000000000000000';
      await expect(batchExecutor.connect(deployer).executeAll())
        .to.emit(batchExecutor, 'TransactionFailed')
        .withArgs(mockDownstream.address, 1, call.data, revertReasonBytes).and
        .not.to.be.reverted;
    });

    it('should have 3 transactions', async function () {
      expect(await batchExecutor.transactionsSize()).to.eq(3);
    });
  });

  describe('Access Control', function () {
    describe('addTransaction', async function () {
      it('should be callable by owner', async function () {
        const updateNoArgEncoded = await mockDownstream.populateTransaction.updateNoArg();
        await expect(
          batchExecutor
            .connect(deployer)
            .addTransaction(mockDownstream.address, 0, updateNoArgEncoded.data),
        ).to.not.be.reverted;
      });

      it('should not be callable by others', async function () {
        const updateNoArgEncoded = await mockDownstream.populateTransaction.updateNoArg();
        await expect(
          batchExecutor
            .connect(user)
            .addTransaction(mockDownstream.address, 0, updateNoArgEncoded.data),
        ).to.be.reverted;
      });
    });

    describe('setTransactionEnabled', async function () {
      beforeEach('adding 1 tx', async function () {
        const updateOneArgEncoded = await mockDownstream.populateTransaction.updateOneArg(
          12345,
        );
        await batchExecutor
          .connect(deployer)
          .addTransaction(mockDownstream.address, 0, updateOneArgEncoded.data);
      });

      it('should be callable by owner', async function () {
        expect(await batchExecutor.transactionsSize()).to.gt(0);
        await expect(
          batchExecutor.connect(deployer).setTransactionEnabled(0, true),
        ).to.not.be.reverted;
      });

      it('should revert if index out of bounds', async function () {
        expect(await batchExecutor.transactionsSize()).to.lt(6);
        await expect(
          batchExecutor.connect(deployer).setTransactionEnabled(6, true),
        ).to.be.reverted;
      });

      it('should not be callable by others', async function () {
        expect(await batchExecutor.transactionsSize()).to.gt(0);
        await expect(batchExecutor.connect(user).setTransactionEnabled(0, true))
          .to.be.reverted;
      });
    });

    describe('removeTransaction', async function () {
      beforeEach('adding 1 tx', async function () {
        const updateOneArgEncoded = await mockDownstream.populateTransaction.updateOneArg(
          12345,
        );
        await batchExecutor
          .connect(deployer)
          .addTransaction(mockDownstream.address, 0, updateOneArgEncoded.data);
      });

      it('should not be callable by others', async function () {
        expect(await batchExecutor.transactionsSize()).to.gt(0);
        await expect(batchExecutor.connect(user).removeTransaction(0)).to.be
          .reverted;
      });

      it('should revert if index out of bounds', async function () {
        expect(await batchExecutor.transactionsSize()).to.lt(6);
        await expect(batchExecutor.connect(deployer).removeTransaction(6)).to.be
          .reverted;
      });

      it('should be callable by owner', async function () {
        expect(await batchExecutor.transactionsSize()).to.gt(0);
        await expect(batchExecutor.connect(deployer).removeTransaction(0)).to
          .not.be.reverted;
      });
    });

    describe('transferOwnership', async function () {
      it('should transfer ownership', async function () {
        expect(await batchExecutor.owner()).to.eq(await deployer.getAddress());
        await batchExecutor
          .connect(deployer)
          .transferOwnership(user.getAddress());
        expect(await batchExecutor.owner()).to.eq(await user.getAddress());
      });
    });
  });
});
