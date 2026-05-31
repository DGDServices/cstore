# Bitcoin Core RPC Integration

## Overview

The CStore platform now supports direct integration with Bitcoin Core node through RPC (Remote Procedure Call). This provides enhanced functionality for Bitcoin wallet operations, transaction management, and blockchain queries without relying on third-party APIs.

## Features

### Core Functionality
- ✅ Direct Bitcoin Core node connection
- ✅ Wallet creation and management
- ✅ Transaction verification via RPC
- ✅ Transaction broadcasting
- ✅ Address generation (Legacy, P2SH-SegWit, Bech32)
- ✅ Balance queries
- ✅ Transaction history
- ✅ Fee estimation
- ✅ Blockchain info queries
- ✅ Automatic fallback to public APIs when RPC is not configured

### Integration
- Seamless integration with existing blockchain service
- Automatic detection and use of RPC when available
- Graceful fallback to public APIs (blockchain.info)
- No breaking changes to existing functionality

## Setup

### 1. Install and Configure Bitcoin Core

#### Download Bitcoin Core
Download from [bitcoin.org](https://bitcoin.org/en/download)

#### Configure bitcoin.conf
Create or edit `~/.bitcoin/bitcoin.conf`:

```ini
# Network
testnet=1  # Use testnet for testing (0 for mainnet)

# RPC Server
server=1
rpcuser=your_rpc_username
rpcpassword=your_secure_rpc_password
rpcport=8332  # 18332 for testnet

# Allow connections from localhost
rpcallowip=127.0.0.1
rpcbind=127.0.0.1

# Optional: Prune blockchain to save disk space (300000 MB = ~300GB)
prune=300000
```

#### Start Bitcoin Core
```bash
# Linux/Mac
bitcoind -daemon

# Or use Bitcoin Core GUI application
```

### 2. Configure CStore Application

Add the following to your `.env` file:

```bash
# Bitcoin Core RPC Configuration
BTC_RPC_HOST=localhost
BTC_RPC_PORT=8332          # 18332 for testnet
BTC_RPC_USER=your_rpc_username
BTC_RPC_PASSWORD=your_secure_rpc_password
BTC_NETWORK=mainnet        # or 'testnet'
```

### 3. Verify Connection

The service will automatically initialize when credentials are provided. Check the logs for:
```
info: Bitcoin Core RPC client initialized: localhost:8332
```

If credentials are not configured, the service will log:
```
warn: Bitcoin Core RPC credentials not configured. RPC functionality will be disabled.
```

## Usage

### Transaction Verification

The blockchain service automatically uses RPC when available:

```javascript
const { verifyTransaction } = require('./services/blockchainService');

// Automatically uses RPC if configured, otherwise falls back to public API
const result = await verifyTransaction(
  'BTC',
  'transaction-hash',
  'recipient-address',
  0.001  // amount in BTC
);
```

### Direct RPC Operations

You can also use the Bitcoin RPC service directly:

```javascript
const bitcoinRpcService = require('./services/bitcoinRpcService');

// Check if RPC is available
if (bitcoinRpcService.isRpcAvailable()) {
  // Get blockchain info
  const info = await bitcoinRpcService.getBlockchainInfo();
  
  // Create a wallet
  const wallet = await bitcoinRpcService.createWallet('my-wallet');
  
  // Get new address
  const address = await bitcoinRpcService.getNewAddress('my-wallet', 'bech32');
  
  // Get wallet balance
  const balance = await bitcoinRpcService.getWalletBalance('my-wallet');
  
  // List transactions
  const txs = await bitcoinRpcService.listTransactions('my-wallet', 10);
  
  // Estimate fee
  const fee = await bitcoinRpcService.estimateFee(6);  // 6 blocks
  
  // Broadcast transaction
  const result = await bitcoinRpcService.broadcastTransaction(rawTxHex);
}
```

## API Reference

### bitcoinRpcService Methods

#### initializeBitcoinRpcClient(config)
Initialize Bitcoin Core RPC client with custom configuration.
- **config**: Configuration object
  - `network`: 'mainnet' or 'testnet' (default: from env)
  - `host`: Bitcoin Core host (default: 'localhost')
  - `port`: RPC port (default: 8332)
  - `username`: RPC username
  - `password`: RPC password
  - `timeout`: Request timeout in ms (default: 30000)
- **Returns**: Client instance or null

#### isRpcAvailable()
Check if RPC is configured and available.
- **Returns**: boolean

#### getBlockchainInfo()
Get blockchain information from Bitcoin Core.
- **Returns**: Promise<Object> - Blockchain info including chain, blocks, difficulty, etc.

#### getTransaction(txid)
Get transaction details by transaction ID.
- **txid**: Transaction ID
- **Returns**: Promise<Object> - Transaction details

#### verifyBitcoinTransactionRpc(txHash, expectedAddress, expectedAmount)
Verify a Bitcoin transaction using RPC.
- **txHash**: Transaction hash
- **expectedAddress**: Expected recipient address
- **expectedAmount**: Expected amount in BTC
- **Returns**: Promise<Object> - Verification result

#### createWallet(walletName, options)
Create a new wallet in Bitcoin Core.
- **walletName**: Name for the new wallet
- **options**: Optional configuration
  - `disablePrivateKeys`: Create watch-only wallet (default: false)
  - `blank`: Create blank wallet (default: false)
  - `passphrase`: Encrypt wallet with passphrase (default: '')
  - `avoidReuse`: Avoid address reuse (default: false)
  - `descriptors`: Use descriptor wallets (default: true)
- **Returns**: Promise<Object> - Wallet creation result

#### loadWallet(walletName)
Load an existing wallet.
- **walletName**: Name of wallet to load
- **Returns**: Promise<Object> - Load result

#### getNewAddress(walletName, addressType)
Generate a new address from wallet.
- **walletName**: Wallet name
- **addressType**: 'legacy', 'p2sh-segwit', or 'bech32' (default: 'bech32')
- **Returns**: Promise<Object> - New address

#### getWalletBalance(walletName)
Get wallet balance.
- **walletName**: Wallet name
- **Returns**: Promise<Object> - Balance in BTC

#### listTransactions(walletName, count)
List wallet transactions.
- **walletName**: Wallet name
- **count**: Number of transactions to return (default: 10)
- **Returns**: Promise<Object> - Transaction list

#### broadcastTransaction(rawTx)
Broadcast a raw transaction to the network.
- **rawTx**: Raw transaction hex
- **Returns**: Promise<Object> - Transaction ID

#### estimateFee(confirmationTarget)
Estimate transaction fee for target confirmation time.
- **confirmationTarget**: Target blocks for confirmation (default: 6)
- **Returns**: Promise<Object> - Fee rate and blocks

## Security Considerations

### RPC Credentials
- **Never commit RPC credentials to source control**
- Use strong, unique passwords for RPC access
- Store credentials in environment variables only
- Rotate RPC passwords regularly

### Network Security
- Only allow RPC connections from trusted IPs
- Use `rpcallowip` to restrict access
- Consider using SSH tunneling for remote access
- Enable SSL/TLS for remote connections

### Wallet Security
- Use encrypted wallets with strong passphrases
- Keep Bitcoin Core updated to latest version
- Regularly backup wallet files
- Consider using hardware wallets for cold storage
- Use multi-signature wallets for high-value transactions

### Production Considerations
- Run Bitcoin Core on dedicated server
- Use separate wallets for hot/cold storage
- Implement rate limiting for RPC calls
- Monitor RPC access logs
- Set up alerting for unusual activity

## Testing

Run the test suite:
```bash
npm test -- bitcoinRpc.test.js
```

**Test Coverage:**
- Client initialization ✓
- RPC availability checks ✓
- Transaction verification ✓
- Wallet operations ✓
- Blockchain queries ✓
- Error handling ✓

## Troubleshooting

### Connection Issues

**Problem**: Cannot connect to Bitcoin Core
**Solutions**:
- Check if Bitcoin Core is running: `bitcoin-cli getblockchaininfo`
- Verify RPC port is correct (8332 for mainnet, 18332 for testnet)
- Check firewall settings
- Verify rpcallowip settings in bitcoin.conf

**Problem**: Authentication failed
**Solutions**:
- Double-check RPC username and password
- Restart Bitcoin Core after changing bitcoin.conf
- Verify credentials match between bitcoin.conf and .env

### Synchronization Issues

**Problem**: Transaction not found
**Solutions**:
- Check if Bitcoin Core is fully synced
- Use `bitcoin-cli getblockchaininfo` to check sync status
- Wait for sync to complete before verifying transactions

**Problem**: Slow performance
**Solutions**:
- Enable transaction indexing: `txindex=1` in bitcoin.conf
- Allocate more memory: `dbcache=4096` in bitcoin.conf
- Use SSD for blockchain data
- Consider pruning if disk space is limited

## Advantages Over Public APIs

### Reliability
- No rate limiting from third-party APIs
- No dependency on external service availability
- Direct blockchain access

### Privacy
- Transactions not exposed to third parties
- Full control over data
- Enhanced security

### Features
- Full wallet management
- Advanced transaction construction
- Real-time blockchain data
- Custom transaction broadcasting

### Cost
- No API fees
- One-time infrastructure cost
- Scales with your needs

## Migration from Public APIs

The integration is designed for seamless migration:

1. **No code changes required** - Existing transaction verification continues to work
2. **Automatic detection** - RPC is used when configured, public APIs otherwise
3. **Gradual adoption** - Start with testnet, migrate to mainnet when ready
4. **Backward compatible** - Can switch back to public APIs anytime

## Future Enhancements

Planned improvements:
- [ ] Multi-wallet support in API
- [ ] PSBT (Partially Signed Bitcoin Transaction) support
- [ ] Advanced fee management
- [ ] Transaction batching
- [ ] WebSocket notifications for new transactions
- [ ] Lightning Network integration via Bitcoin Core

## Resources

### Documentation
- [Bitcoin Core RPC Documentation](https://developer.bitcoin.org/reference/rpc/)
- [Bitcoin Core Installation Guide](https://bitcoin.org/en/full-node)
- [Bitcoin RPC Authentication](https://github.com/bitcoin/bitcoin/blob/master/doc/JSON-RPC-interface.md)

### Tools
- [Bitcoin Core](https://bitcoin.org/en/download)
- [bitcoin-cli](https://developer.bitcoin.org/reference/rpc/) - Command line interface
- [Bitcoin Explorer](https://github.com/libbitcoin/libbitcoin-explorer) - BX tool

---

**Implementation Date:** January 2025  
**Version:** 2.2  
**Status:** ✅ COMPLETE and Production Ready
