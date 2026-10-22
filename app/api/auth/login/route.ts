import { NextRequest, NextResponse } from 'next/server';
import {
  createSessionToken,
  recordFailedAttempt,
  resetRateLimit,
  checkRateLimit,
  validatePin,
  SESSION_COOKIE_NAME,
  SESSION_DURATION,
} from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-real-ip')
    || request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || 'unknown';
  const rate = checkRateLimit(ip);
  if (!rate.allowed) {
    return NextResponse.json(
      { error: 'Demasiados intentos. Inténtalo de nuevo más tarde.' },
      { status: 429, headers: { 'Retry-After': String(rate.waitSeconds) } },
    );
  }

  let body: { pin?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Solicitud inválida.' }, { status: 400 });
  }

  if (typeof body.pin !== 'string' || body.pin.length > 128) {
    recordFailedAttempt(ip);
    return NextResponse.json({ error: 'PIN incorrecto.' }, { status: 401 });
  }
  if (!process.env.ACCESS_PIN || !process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    return NextResponse.json({ error: 'La autenticación no está configurada en el servidor.' }, { status: 503 });
  }
  if (!validatePin(body.pin)) {
    recordFailedAttempt(ip);
    return NextResponse.json({ error: 'PIN incorrecto.' }, { status: 401 });
  }

  resetRateLimit(ip);
  const token = await createSessionToken();
  const response = NextResponse.json({ authenticated: true });
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_DURATION,
  });
  return response;
}
