import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
const scrypt = (password, salt) => new Promise((resolve, reject) => {
    scryptCallback(password, salt, 64, { N: 32_768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => {
        if (error)
            reject(error);
        else
            resolve(key);
    });
});
export async function hashPassword(password) {
    const salt = randomBytes(16);
    const key = await scrypt(password, salt);
    return `scrypt$32768$8$1$${salt.toString('base64url')}$${key.toString('base64url')}`;
}
export async function verifyPassword(password, encoded) {
    const [algorithm, cost, blockSize, parallelism, encodedSalt, encodedKey, extra] = encoded.split('$');
    if (algorithm !== 'scrypt' || cost !== '32768' || blockSize !== '8' || parallelism !== '1' || !encodedSalt || !encodedKey || extra !== undefined) {
        return false;
    }
    const salt = Buffer.from(encodedSalt, 'base64url');
    const expected = Buffer.from(encodedKey, 'base64url');
    if (salt.length !== 16 || expected.length !== 64)
        return false;
    const actual = await scrypt(password, salt);
    return timingSafeEqual(actual, expected);
}
