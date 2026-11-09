const mongoose = require('mongoose');

let supportsTransactionsCache = null;

/**
 * Checks whether the connected MongoDB deployment supports multi-document transactions.
 * Transactions are supported on MongoDB Replica Sets (hello.setName is defined)
 * and Sharded Clusters (hello.msg === 'isdbgrid'), but NOT on standalone instances.
 */
async function supportsTransactions() {
  if (supportsTransactionsCache !== null) {
    return supportsTransactionsCache;
  }
  try {
    if (!mongoose.connection || mongoose.connection.readyState !== 1) {
      return false;
    }

    const hello = await mongoose.connection.db.admin().command({ hello: 1 });
    supportsTransactionsCache = Boolean(hello && (hello.setName || hello.msg === 'isdbgrid'));
    return supportsTransactionsCache;
  } catch {
    supportsTransactionsCache = false;
    return false;
  }
}

/**
 * Executes an operation within a MongoDB transaction when supported by the cluster,
 * or gracefully runs operations on standalone environments.
 *
 * @template T
 * @param {(session: import('mongoose').ClientSession | null) => Promise<T>} workFn
 * @returns {Promise<T>}
 */
async function withTransaction(workFn) {
  const isSupported = await supportsTransactions();
  if (!isSupported) {
    return await workFn(null);
  }

  const session = await mongoose.startSession();
  try {
    session.startTransaction();
    const result = await workFn(session);
    await session.commitTransaction();
    return result;
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    throw error;
  } finally {
    session.endSession();
  }
}

module.exports = {
  supportsTransactions,
  withTransaction,
};
