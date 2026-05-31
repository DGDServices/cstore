const bitcoinRpcService = require('../src/services/bitcoinRpcService');

describe('Bitcoin Core RPC Service', () => {
  describe('Initialization', () => {
    it('should handle missing credentials gracefully', () => {
      const client = bitcoinRpcService.initializeBitcoinRpcClient({
        username: undefined,
        password: undefined
      });
      expect(client).toBeNull();
    });

    it('should check RPC availability', () => {
      const available = bitcoinRpcService.isRpcAvailable();
      expect(typeof available).toBe('boolean');
    });
  });

  describe('Transaction Verification (Mock)', () => {
    it('should return error when RPC is not configured', async () => {
      // This test assumes RPC is not configured in test environment
      const result = await bitcoinRpcService.verifyBitcoinTransactionRpc(
        'mock-tx-hash',
        'bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh',
        0.001
      );
      
      expect(result).toHaveProperty('verified');
      expect(result.verified).toBe(false);
      expect(result).toHaveProperty('error');
    });
  });

  describe('Wallet Operations (Mock)', () => {
    it('should throw error for createWallet without RPC', async () => {
      await expect(
        bitcoinRpcService.createWallet('test-wallet')
      ).rejects.toThrow('Bitcoin Core RPC not configured');
    });

    it('should throw error for getWalletBalance without RPC', async () => {
      await expect(
        bitcoinRpcService.getWalletBalance('test-wallet')
      ).rejects.toThrow('Bitcoin Core RPC not configured');
    });

    it('should throw error for getNewAddress without RPC', async () => {
      await expect(
        bitcoinRpcService.getNewAddress('test-wallet')
      ).rejects.toThrow('Bitcoin Core RPC not configured');
    });

    it('should throw error for listTransactions without RPC', async () => {
      await expect(
        bitcoinRpcService.listTransactions('test-wallet')
      ).rejects.toThrow('Bitcoin Core RPC not configured');
    });
  });

  describe('Blockchain Operations (Mock)', () => {
    it('should throw error for getBlockchainInfo without RPC', async () => {
      await expect(
        bitcoinRpcService.getBlockchainInfo()
      ).rejects.toThrow('Bitcoin Core RPC not configured');
    });

    it('should throw error for getTransaction without RPC', async () => {
      await expect(
        bitcoinRpcService.getTransaction('mock-tx-id')
      ).rejects.toThrow('Bitcoin Core RPC not configured');
    });

    it('should throw error for broadcastTransaction without RPC', async () => {
      await expect(
        bitcoinRpcService.broadcastTransaction('mock-raw-tx')
      ).rejects.toThrow('Bitcoin Core RPC not configured');
    });

    it('should throw error for estimateFee without RPC', async () => {
      await expect(
        bitcoinRpcService.estimateFee()
      ).rejects.toThrow('Bitcoin Core RPC not configured');
    });
  });
});
