import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';

export const SESSION_COOKIE_NAME = 'pm_session';
export const SESSION_DURATION = 60 * 60 * 24 * 30;

// In-memory brute-force protection
interface AttemptRecord {
  count: number;
  blockedUntil: number;
}
const attemptsMap = new Map<string, AttemptRecord>();

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes

function getSecretKey(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET debe estar configurado con al menos 32 caracteres.');
  }
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(): Promise<string> {
  const secret = getSecretKey();
  const token = await new SignJWT({ authenticated: true, role: 'operator' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('30d')
    .sign(secret);
  return token;
}

export async function verifySessionToken(token: string): Promise<boolean> {
  try {
    const secret = getSecretKey();
    const { payload } = await jwtVerify(token, secret);
    return payload.authenticated === true;
  } catch {
    return false;
  }
}

export async function isAuthenticated(): Promise<boolean> {
  try {
    const cookieStore = cookies();
    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME);
    if (!sessionCookie?.value) return false;
    return await verifySessionToken(sessionCookie.value);
  } catch {
    return false;
  }
}

export function checkRateLimit(clientIp: string): { allowed: boolean; waitSeconds?: number } {
  const now = Date.now();
  const record = attemptsMap.get(clientIp);

  if (!record) {
    return { allowed: true };
  }

  if (record.blockedUntil > now) {
    const waitSeconds = Math.ceil((record.blockedUntil - now) / 1000);
    return { allowed: false, waitSeconds };
  }

  // If lockout expired, reset
  if (record.blockedUntil > 0 && record.blockedUntil <= now) {
    attemptsMap.delete(clientIp);
    return { allowed: true };
  }

  return { allowed: true };
}

export function recordFailedAttempt(clientIp: string): void {
  const now = Date.now();
  const record = attemptsMap.get(clientIp) || { count: 0, blockedUntil: 0 };
  record.count += 1;

  if (record.count >= MAX_FAILED_ATTEMPTS) {
    record.blockedUntil = now + LOCKOUT_DURATION_MS;
  }

  attemptsMap.set(clientIp, record);
}

export function resetRateLimit(clientIp: string): void {
  attemptsMap.delete(clientIp);
}

export function validatePin(inputPin: string): boolean {
  const expectedPin = process.env.ACCESS_PIN;
  return Boolean(expectedPin) && inputPin === expectedPin;
}
