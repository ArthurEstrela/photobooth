import { TokenCryptoService } from './token-crypto.service';

const VALID_KEY = 'a'.repeat(64); // 64 hex chars = 32 bytes

describe('TokenCryptoService', () => {
  let service: TokenCryptoService;

  beforeEach(() => {
    process.env.MP_TOKEN_ENCRYPTION_KEY = VALID_KEY;
    service = new TokenCryptoService();
  });

  afterEach(() => {
    delete process.env.MP_TOKEN_ENCRYPTION_KEY;
  });

  it('decrypt(encrypt(x)) returns original plaintext', () => {
    const plaintext = 'APP_USR-some-mp-access-token-12345';
    expect(service.decrypt(service.encrypt(plaintext))).toBe(plaintext);
  });

  it('each encrypt call produces a different ciphertext (random IV)', () => {
    const plaintext = 'APP_USR-token';
    expect(service.encrypt(plaintext)).not.toBe(service.encrypt(plaintext));
  });

  it('ciphertext has iv:tag:ciphertext format (3 colon-separated hex parts)', () => {
    const encrypted = service.encrypt('test');
    const parts = encrypted.split(':');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toMatch(/^[0-9a-f]+$/); // iv
    expect(parts[1]).toMatch(/^[0-9a-f]+$/); // tag
    expect(parts[2]).toMatch(/^[0-9a-f]+$/); // ciphertext
  });

  it('tampered auth tag throws on decrypt', () => {
    const encrypted = service.encrypt('test');
    const parts = encrypted.split(':');
    parts[1] = 'deadbeefdeadbeefdeadbeefdeadbeef'; // replace tag
    expect(() => service.decrypt(parts.join(':'))).toThrow();
  });

  it('throws on missing MP_TOKEN_ENCRYPTION_KEY', () => {
    delete process.env.MP_TOKEN_ENCRYPTION_KEY;
    expect(() => new TokenCryptoService()).toThrow('MP_TOKEN_ENCRYPTION_KEY');
  });

  it('throws on key with wrong length', () => {
    process.env.MP_TOKEN_ENCRYPTION_KEY = 'tooshort';
    expect(() => new TokenCryptoService()).toThrow('MP_TOKEN_ENCRYPTION_KEY');
  });

  it('throws on key with correct length but non-hex characters', () => {
    process.env.MP_TOKEN_ENCRYPTION_KEY = 'g'.repeat(64);
    expect(() => new TokenCryptoService()).toThrow('MP_TOKEN_ENCRYPTION_KEY');
  });

  it('throws on decrypt with malformed format (no colons)', () => {
    expect(() => service.decrypt('notvalid')).toThrow('Invalid encrypted token format');
  });

  it('throws on decrypt with null/undefined input', () => {
    expect(() => service.decrypt(null as any)).toThrow('Invalid encrypted token format');
  });
});
