import { Injectable } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

@Injectable()
export class TokenCryptoService {
  private readonly key: Buffer;

  constructor() {
    const hex = process.env.MP_TOKEN_ENCRYPTION_KEY ?? '';
    if (hex.length !== 64) {
      throw new Error('MP_TOKEN_ENCRYPTION_KEY must be 64 hex chars (32 bytes)');
    }
    this.key = Buffer.from(hex, 'hex');
    if (this.key.length !== 32) {
      throw new Error('MP_TOKEN_ENCRYPTION_KEY must be 64 valid hex chars (32 bytes)');
    }
  }

  encrypt(plaintext: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(stored: string): string {
    const parts = stored?.split(':');
    if (!parts || parts.length !== 3) {
      throw new Error('Invalid encrypted token format');
    }
    const [ivHex, tagHex, encHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const tag = Buffer.from(tagHex, 'hex');
    const encrypted = Buffer.from(encHex, 'hex');
    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
  }
}
