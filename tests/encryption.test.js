const { 
  encrypt, 
  decrypt, 
  hash,
  encryptFields,
  decryptFields,
  isEncryptionAvailable,
  generateEncryptionKey
} = require('../src/utils/encryption');

describe('Field Encryption', () => {
  const originalKey = process.env.FIELD_ENCRYPTION_KEY;

  beforeAll(() => {
    // Set test encryption key
    process.env.FIELD_ENCRYPTION_KEY = generateEncryptionKey();
  });

  afterAll(() => {
    // Restore original key
    process.env.FIELD_ENCRYPTION_KEY = originalKey;
  });

  describe('Basic Encryption', () => {
    it('should encrypt and decrypt text', () => {
      const plainText = 'sensitive data';
      const encrypted = encrypt(plainText);
      const decrypted = decrypt(encrypted);

      expect(encrypted).not.toBe(plainText);
      expect(decrypted).toBe(plainText);
    });

    it('should produce different ciphertext for same plaintext', () => {
      const plainText = 'sensitive data';
      const encrypted1 = encrypt(plainText);
      const encrypted2 = encrypt(plainText);

      // Should be different due to random IV
      expect(encrypted1).not.toBe(encrypted2);
      
      // But both should decrypt to same plaintext
      expect(decrypt(encrypted1)).toBe(plainText);
      expect(decrypt(encrypted2)).toBe(plainText);
    });

    it('should handle empty string', () => {
      const plainText = '';
      const encrypted = encrypt(plainText);
      expect(encrypted).toBe('');
    });

    it('should handle null/undefined', () => {
      expect(encrypt(null)).toBe(null);
      expect(encrypt(undefined)).toBe(undefined);
      expect(decrypt(null)).toBe(null);
      expect(decrypt(undefined)).toBe(undefined);
    });

    it('should encrypt JSON objects', () => {
      const obj = { name: 'John', ssn: '123-45-6789' };
      const encrypted = encrypt(obj);
      const decrypted = decrypt(encrypted);

      expect(encrypted).not.toContain('John');
      expect(encrypted).not.toContain('123-45-6789');
      expect(decrypted).toBe(JSON.stringify(obj));
    });

    it('should handle special characters', () => {
      const plainText = 'Test! @#$%^&*() 中文 émojis 🔐';
      const encrypted = encrypt(plainText);
      const decrypted = decrypt(encrypted);

      expect(decrypted).toBe(plainText);
    });

    it('should fail to decrypt invalid ciphertext', () => {
      expect(() => {
        decrypt('invalid_ciphertext_12345');
      }).toThrow();
    });
  });

  describe('Hashing', () => {
    it('should hash data consistently', () => {
      const plainText = 'sensitive data';
      const hash1 = hash(plainText);
      const hash2 = hash(plainText);

      expect(hash1).toBe(hash2);
      expect(hash1).not.toBe(plainText);
    });

    it('should produce different hash for different data', () => {
      const hash1 = hash('data1');
      const hash2 = hash('data2');

      expect(hash1).not.toBe(hash2);
    });

    it('should be one-way (cannot decrypt hash)', () => {
      const plainText = 'sensitive data';
      const hashed = hash(plainText);

      // Hash is 64 chars (SHA-256)
      expect(hashed.length).toBe(64);
      expect(hashed).toMatch(/^[a-f0-9]+$/);
    });
  });

  describe('Field Encryption', () => {
    it('should encrypt specific fields in object', () => {
      const obj = {
        name: 'John Doe',
        email: 'john@example.com',
        ssn: '123-45-6789',
        publicData: 'visible'
      };

      const encrypted = encryptFields(obj, ['email', 'ssn']);

      expect(encrypted.name).toBe('John Doe');
      expect(encrypted.publicData).toBe('visible');
      expect(encrypted.email).not.toBe('john@example.com');
      expect(encrypted.ssn).not.toBe('123-45-6789');
    });

    it('should decrypt specific fields in object', () => {
      const obj = {
        name: 'John Doe',
        email: 'john@example.com',
        ssn: '123-45-6789'
      };

      const encrypted = encryptFields(obj, ['email', 'ssn']);
      const decrypted = decryptFields(encrypted, ['email', 'ssn']);

      expect(decrypted.name).toBe('John Doe');
      expect(decrypted.email).toBe('john@example.com');
      expect(decrypted.ssn).toBe('123-45-6789');
    });

    it('should handle missing fields gracefully', () => {
      const obj = {
        name: 'John Doe'
      };

      const encrypted = encryptFields(obj, ['email', 'ssn']);
      expect(encrypted.name).toBe('John Doe');
      expect(encrypted.email).toBeUndefined();
      expect(encrypted.ssn).toBeUndefined();
    });
  });

  describe('Key Generation', () => {
    it('should generate valid encryption key', () => {
      const key = generateEncryptionKey();
      
      expect(key).toBeDefined();
      expect(typeof key).toBe('string');
      expect(key.length).toBe(64); // 32 bytes in hex
      expect(key).toMatch(/^[a-f0-9]+$/);
    });

    it('should generate different keys each time', () => {
      const key1 = generateEncryptionKey();
      const key2 = generateEncryptionKey();
      
      expect(key1).not.toBe(key2);
    });
  });

  describe('Configuration', () => {
    it('should check if encryption is available', () => {
      const available = isEncryptionAvailable();
      expect(typeof available).toBe('boolean');
    });

    it('should work with valid key', () => {
      process.env.FIELD_ENCRYPTION_KEY = generateEncryptionKey();
      expect(isEncryptionAvailable()).toBe(true);
    });
  });
});
