const subtle = () => globalThis.crypto.subtle;

/* 1. Tiện ích chuyển đổi dữ liệu*/

export function bufToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin);
}

export function base64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

export function bufToHex(buf: ArrayBuffer): string {
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/* 2. Băm SHA-256 (dùng để kiểm tra toàn vẹn – verifyRecord)*/

export async function sha256Hex(data: ArrayBuffer): Promise<string> {
  return bufToHex(await subtle().digest("SHA-256", data));
}

/* 3. AES-256-GCM – mã hóa dữ liệu */

const IV_LENGTH = 12;

export async function generateAesKey(): Promise<CryptoKey> {
  return subtle().generateKey({ name: "AES-GCM", length: 256 }, true, [
    "encrypt",
    "decrypt",
  ]);
}

export async function encryptData(data: ArrayBuffer, key: CryptoKey): Promise<ArrayBuffer> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH)); // IV mới cho mỗi lần mã hóa
  const ciphertext = await subtle().encrypt({ name: "AES-GCM", iv }, key, data);

  const packed = new Uint8Array(IV_LENGTH + ciphertext.byteLength);
  packed.set(iv, 0);
  packed.set(new Uint8Array(ciphertext), IV_LENGTH);
  return packed.buffer;
}

export async function decryptData(packed: ArrayBuffer, key: CryptoKey): Promise<ArrayBuffer> {
  const bytes = new Uint8Array(packed);
  const iv = bytes.slice(0, IV_LENGTH);
  const ciphertext = bytes.slice(IV_LENGTH);
  return subtle().decrypt({ name: "AES-GCM", iv }, key, ciphertext);
}

/* 4. RSA-OAEP 2048 – cặp khóa của bệnh nhân / bác sĩ */

const RSA_ALGORITHM: RsaHashedKeyGenParams = {
  name: "RSA-OAEP",
  modulusLength: 2048,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: "SHA-256",
};

export async function generateRsaKeyPair(): Promise<CryptoKeyPair> {
  return subtle().generateKey(RSA_ALGORITHM, true, ["encrypt", "decrypt"]);
}

function toPem(buf: ArrayBuffer, label: string): string {
  const lines = bufToBase64(buf).match(/.{1,64}/g) ?? [];
  return `-----BEGIN ${label}-----\n${lines.join("\n")}\n-----END ${label}-----`;
}

function fromPem(pem: string): ArrayBuffer {
  return base64ToBuf(pem.replace(/-----[^-]+-----/g, "").replace(/\s+/g, ""));
}

export async function exportPublicKeyPem(key: CryptoKey): Promise<string> {
  return toPem(await subtle().exportKey("spki", key), "PUBLIC KEY");
}

export async function importPublicKeyPem(pem: string): Promise<CryptoKey> {
  return subtle().importKey("spki", fromPem(pem), { name: "RSA-OAEP", hash: "SHA-256" }, true, [
    "encrypt",
  ]);
}

export async function exportPrivateKeyPem(key: CryptoKey): Promise<string> {
  return toPem(await subtle().exportKey("pkcs8", key), "PRIVATE KEY");
}

export async function importPrivateKeyPem(pem: string): Promise<CryptoKey> {
  return subtle().importKey("pkcs8", fromPem(pem), { name: "RSA-OAEP", hash: "SHA-256" }, true, [
    "decrypt",
  ]);
}

/* 5. Bọc / mở khóa AES bằng RSA */

export async function wrapAesKey(aesKey: CryptoKey, rsaPublicKey: CryptoKey): Promise<string> {
  const rawKey = await subtle().exportKey("raw", aesKey);
  const wrapped = await subtle().encrypt({ name: "RSA-OAEP" }, rsaPublicKey, rawKey);
  return bufToBase64(wrapped);
}

/** Mở khóa AES bằng private key. Sai private key => báo lỗi OperationError. */
export async function unwrapAesKey(wrappedB64: string, rsaPrivateKey: CryptoKey): Promise<CryptoKey> {
  const rawKey = await subtle().decrypt({ name: "RSA-OAEP" }, rsaPrivateKey, base64ToBuf(wrappedB64));
  return subtle().importKey("raw", rawKey, { name: "AES-GCM" }, true, ["encrypt", "decrypt"]);
}

/* 6. Sao lưu private key bằng mật khẩu (PBKDF2-SHA256 + AES-GCM) */

const PBKDF2_ITERATIONS = 600_000;

export type KeyBackup = {
  version: 1;
  kdf: "PBKDF2-SHA256";
  iterations: number;
  salt: string; // base64
  data: string; // base64: IV + private key đã mã hóa + authTag
};

async function keyFromPassword(password: string, salt: ArrayBuffer, iterations: number): Promise<CryptoKey> {
  const baseKey = await subtle().importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
    "deriveKey",
  ]);
  return subtle().deriveKey(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function backupPrivateKey(privateKey: CryptoKey, password: string): Promise<KeyBackup> {
  const salt = crypto.getRandomValues(new Uint8Array(16)).buffer;
  const pkcs8 = await subtle().exportKey("pkcs8", privateKey);
  const data = await encryptData(pkcs8, await keyFromPassword(password, salt, PBKDF2_ITERATIONS));
  return {
    version: 1,
    kdf: "PBKDF2-SHA256",
    iterations: PBKDF2_ITERATIONS,
    salt: bufToBase64(salt),
    data: bufToBase64(data),
  };
}

/** Sai mật khẩu => authTag không khớp => báo lỗi OperationError. */
export async function restorePrivateKey(backup: KeyBackup, password: string): Promise<CryptoKey> {
  const key = await keyFromPassword(password, base64ToBuf(backup.salt), backup.iterations);
  const pkcs8 = await decryptData(base64ToBuf(backup.data), key);
  return subtle().importKey("pkcs8", pkcs8, { name: "RSA-OAEP", hash: "SHA-256" }, true, ["decrypt"]);
}