/**
 * Portable credential and session primitives.
 *
 * Uses only WebCrypto, which is available in Node 18+, Cloudflare Workers and
 * Pages Functions, so the exact same code protects accounts everywhere.
 * Passwords are stored as PBKDF2-SHA256 digests; session tokens are random and
 * only their SHA-256 hash is persisted, so a leaked store cannot be replayed.
 */

export interface PasswordRecord {
  algo: 'pbkdf2-sha256';
  iterations: number;
  salt: string;
  hash: string;
}

export const DEFAULT_ITERATIONS = 150_000;
const KEY_BITS = 256;

export function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

export function randomBytes(length = 32): Uint8Array {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  return bytes;
}

export function randomToken(length = 32): string {
  return toBase64(randomBytes(length)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function derive(password: string, salt: Uint8Array, iterations: number): Promise<ArrayBuffer> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password) as unknown as BufferSource,
    'PBKDF2',
    false,
    ['deriveBits'],
  );
  return crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: salt as unknown as BufferSource, iterations, hash: 'SHA-256' },
    material,
    KEY_BITS,
  );
}

export async function hashPassword(password: string, iterations = DEFAULT_ITERATIONS): Promise<PasswordRecord> {
  const salt = randomBytes(16);
  const bits = await derive(password, salt, iterations);
  return {
    algo: 'pbkdf2-sha256',
    iterations,
    salt: toBase64(salt),
    hash: toBase64(new Uint8Array(bits)),
  };
}

export async function verifyPassword(password: string, record: PasswordRecord): Promise<boolean> {
  if (!record || record.algo !== 'pbkdf2-sha256') return false;
  const salt = fromBase64(record.salt);
  const bits = new Uint8Array(await derive(password, salt, record.iterations));
  const expected = fromBase64(record.hash);
  if (expected.length !== bits.length) return false;
  // Constant-time comparison so timing cannot reveal how much of the hash matched.
  let diff = 0;
  for (let i = 0; i < bits.length; i += 1) diff |= bits[i] ^ expected[i];
  return diff === 0;
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value) as unknown as BufferSource);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/* --------------------------------------------------------------- validation */

export function normalizeEmail(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

export function emailProblem(email: string): string | null {
  if (!email) return 'Enter your email address.';
  if (email.length > 254) return 'That email address is too long.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return 'Enter a valid email address.';
  return null;
}

export function passwordProblem(password: unknown): string | null {
  if (typeof password !== 'string' || !password) return 'Choose a password.';
  if (password.length < 8) return 'Use at least 8 characters.';
  if (password.length > 200) return 'That password is too long.';
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return 'Include at least one letter and one number.';
  }
  return null;
}

export function normalizeName(raw: unknown, fallback = ''): string {
  const value = typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
  return (value || fallback).slice(0, 80);
}

/* ------------------------------------------------------------------ cookies */

export const SESSION_COOKIE = 'bf_session';

export function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const index = part.indexOf('=');
    if (index < 0) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (name) out[name] = decodeURIComponent(value);
  }
  return out;
}

export function sessionTokenFrom(headers: Record<string, string | undefined>): string | null {
  const cookies = parseCookies(headers.cookie ?? headers.Cookie);
  return cookies[SESSION_COOKIE] ?? null;
}

export function isSecureRequest(headers: Record<string, string | undefined>): boolean {
  const proto = headers['x-forwarded-proto'] ?? headers['X-Forwarded-Proto'];
  return typeof proto === 'string' && proto.split(',')[0].trim() === 'https';
}

export function buildSessionCookie(token: string, maxAgeSeconds: number, secure: boolean): string {
  const parts = [
    `${SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAgeSeconds}`,
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function buildClearedSessionCookie(secure: boolean): string {
  const parts = [`${SESSION_COOKIE}=`, 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}
