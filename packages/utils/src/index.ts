import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export async function hashApiKey(key: string): Promise<string> {
  return bcrypt.hash(key, SALT_ROUNDS);
}

export async function verifyApiKey(
  key: string,
  hash: string,
): Promise<boolean> {
  return bcrypt.compare(key, hash);
}

export function generateApiKey(prefix: string = 'ak'): string {
  const randomBytes = crypto.getRandomValues(new Uint8Array(32));
  const base64 = Buffer.from(randomBytes).toString('base64url');
  return `${prefix}_${base64}`;
}
