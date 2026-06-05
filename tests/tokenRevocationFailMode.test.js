/**
 * Token revocation fail-mode policy (priority #3).
 *
 * Targets the LIVE blacklist used by the auth middleware/controller
 * (`src/utils/tokenBlacklist.js`, backed by `config/redis`) — not the unused
 * `src/services/tokenBlacklist.js` duplicate. Runs with Redis mocked as DOWN, so it
 * is deterministic and needs no external service:
 *   - default / 'open'  -> the token is allowed through (availability first)
 *   - 'closed'          -> the token is denied (fail secure)
 */

jest.mock('../src/config/redis', () => ({
  isRedisAvailable: jest.fn(() => false), // simulate Redis outage
  getRedisClient: jest.fn(() => ({}))
}));

const tokenBlacklist = require('../src/utils/tokenBlacklist');

describe('Token revocation fail-mode (Redis unavailable)', () => {
  const ORIGINAL = process.env.TOKEN_REVOCATION_FAIL_MODE;
  afterAll(() => {
    if (ORIGINAL === undefined) delete process.env.TOKEN_REVOCATION_FAIL_MODE;
    else process.env.TOKEN_REVOCATION_FAIL_MODE = ORIGINAL;
  });

  describe('default (fail-open)', () => {
    beforeEach(() => { delete process.env.TOKEN_REVOCATION_FAIL_MODE; });

    it('isBlacklisted allows the token (returns not-blacklisted)', async () => {
      await expect(tokenBlacklist.isBlacklisted('any.jwt.token')).resolves.toBe(false);
    });

    it('areUserTokensRevoked allows the token (returns not-revoked)', async () => {
      await expect(tokenBlacklist.areUserTokensRevoked('user123', 1_700_000_000)).resolves.toBe(false);
    });
  });

  describe('TOKEN_REVOCATION_FAIL_MODE=closed (fail secure)', () => {
    beforeEach(() => { process.env.TOKEN_REVOCATION_FAIL_MODE = 'closed'; });

    it('isBlacklisted denies the token (treats as blacklisted)', async () => {
      await expect(tokenBlacklist.isBlacklisted('any.jwt.token')).resolves.toBe(true);
    });

    it('areUserTokensRevoked denies the token (treats as revoked)', async () => {
      await expect(tokenBlacklist.areUserTokensRevoked('user123', 1_700_000_000)).resolves.toBe(true);
    });
  });
});
