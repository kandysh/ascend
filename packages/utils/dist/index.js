import bcrypt from 'bcrypt';
const SALT_ROUNDS = 10;
export async function hashApiKey(key) {
    return bcrypt.hash(key, SALT_ROUNDS);
}
export async function verifyApiKey(key, hash) {
    return bcrypt.compare(key, hash);
}
export function generateApiKey(prefix = 'ak') {
    const randomBytes = crypto.getRandomValues(new Uint8Array(32));
    const base64 = Buffer.from(randomBytes).toString('base64url');
    return `${prefix}_${base64}`;
}
