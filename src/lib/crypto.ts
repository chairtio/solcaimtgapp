import CryptoJS from 'crypto-js'

// Generate a random salt for key derivation
export function generateSalt(): string {
  return CryptoJS.lib.WordArray.random(128/8).toString()
}

// Derive a key from password and salt using PBKDF2
export function deriveKey(password: string, salt: string): string {
  return CryptoJS.PBKDF2(password, salt, {
    keySize: 256/32,
    iterations: 10000
  }).toString()
}

// Encrypt private key
export function encryptPrivateKey(privateKey: string, key: string): string {
  return CryptoJS.AES.encrypt(privateKey, key).toString()
}

// Decrypt private key
export function decryptPrivateKey(encryptedKey: string, key: string): string {
  const bytes = CryptoJS.AES.decrypt(encryptedKey, key)
  return bytes.toString(CryptoJS.enc.Utf8)
}

// Hash for additional security (not used for encryption)
export function hashString(input: string): string {
  return CryptoJS.SHA256(input).toString()
}

// Secure random string generation
export function generateSecureToken(length: number = 32): string {
  return CryptoJS.lib.WordArray.random(length/2).toString()
}