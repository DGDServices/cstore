const { isValidBitcoinAddress } = require('../src/utils/addressValidation');

describe('Bitcoin Address Validation', () => {
  describe('isValidBitcoinAddress', () => {
    it('should validate correct P2PKH (legacy) Bitcoin addresses', () => {
      // Valid mainnet P2PKH addresses
      expect(isValidBitcoinAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe(true);
      expect(isValidBitcoinAddress('1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2')).toBe(true);
      expect(isValidBitcoinAddress('1BoatSLRHtKNngkdXEeobR76b53LETtpyT')).toBe(true);
    });

    it('should validate correct P2SH Bitcoin addresses', () => {
      // Valid mainnet P2SH addresses (start with 3)
      expect(isValidBitcoinAddress('3Ai1JZ8pdJb2ksieUV8FsxSNVJCpoPi8W6')).toBe(true);
      expect(isValidBitcoinAddress('35hK24tcLEWcgNA4JxpvbkNkoAcDGqQPsP')).toBe(true);
    });

    it('should validate correct Bech32 (native SegWit) Bitcoin addresses', () => {
      // Valid mainnet Bech32 addresses (start with bc1)
      expect(isValidBitcoinAddress('bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4')).toBe(true);
      expect(isValidBitcoinAddress('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq')).toBe(true);
    });

    it('should validate testnet Bitcoin addresses', () => {
      // Valid testnet addresses
      expect(isValidBitcoinAddress('mipcBbFg9gMiCh81Kj8tqqdgoZub1ZJRfn')).toBe(true);
      expect(isValidBitcoinAddress('2MzQwSSnBHWHqSAqtTVQ6v47XtaisrJa1Vc')).toBe(true);
      expect(isValidBitcoinAddress('tb1qw508d6qejxtdg4y5r3zarvary0c5xw7kxpjzsx')).toBe(true);
    });

    it('should reject invalid Bitcoin addresses', () => {
      // Invalid addresses
      expect(isValidBitcoinAddress('1InvalidAddress')).toBe(false);
      expect(isValidBitcoinAddress('not-a-bitcoin-address')).toBe(false);
      expect(isValidBitcoinAddress('1111111111111111111111111111111111')).toBe(false);
      expect(isValidBitcoinAddress('bc1qinvalidbech32address')).toBe(false);
    });

    it('should reject Ethereum addresses', () => {
      // Ethereum address should not be valid for Bitcoin
      expect(isValidBitcoinAddress('0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb')).toBe(false);
      expect(isValidBitcoinAddress('0x0000000000000000000000000000000000000000')).toBe(false);
    });

    it('should reject empty or invalid inputs', () => {
      expect(isValidBitcoinAddress('')).toBe(false);
      expect(isValidBitcoinAddress(null)).toBe(false);
      expect(isValidBitcoinAddress(undefined)).toBe(false);
      expect(isValidBitcoinAddress(123)).toBe(false);
      expect(isValidBitcoinAddress({})).toBe(false);
      expect(isValidBitcoinAddress([])).toBe(false);
    });

    it('should reject addresses with special characters', () => {
      expect(isValidBitcoinAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa!')).toBe(false);
      expect(isValidBitcoinAddress('1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa ')).toBe(false);
      expect(isValidBitcoinAddress(' 1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa')).toBe(false);
    });

    it('should reject addresses that are too short or too long', () => {
      expect(isValidBitcoinAddress('1')).toBe(false);
      expect(isValidBitcoinAddress('1A')).toBe(false);
      expect(isValidBitcoinAddress('1' + 'A'.repeat(100))).toBe(false);
    });

    it('should handle case sensitivity correctly', () => {
      // Bitcoin addresses are case-sensitive
      const validAddress = '1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa';
      expect(isValidBitcoinAddress(validAddress)).toBe(true);
      // Changing case might invalidate the address due to checksum
      expect(isValidBitcoinAddress(validAddress.toLowerCase())).toBe(false);
    });
  });
});
