import crypto from 'node:crypto';
import type {NextFunction, Request, Response} from 'express';
import type {CloudRepository} from './repository';

const SCRYPT_PARAMS = {N: 16384, r: 8, p: 1};
const SCRYPT_KEYLEN = 64;
const DUMMY_SALT = '00112233445566778899aabbccddeeff';

export const SESSION_COOKIE_NAME = 'wafa_session';
export const CSRF_COOKIE_NAME = 'wafa_csrf';
export const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export function hashPassword(password: string): {hash: string; salt: string} {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS).toString('hex');
  return {hash: derived, salt};
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  if (!hash || !salt) return false;
  const derived = crypto.scryptSync(password, salt, SCRYPT_KEYLEN, SCRYPT_PARAMS);
  const stored = Buffer.from(hash, 'hex');
  if (derived.length !== stored.length) return false;
  return crypto.timingSafeEqual(derived, stored);
}

/**
 * Runs a constant-work scrypt derivation when an account does not exist so
 * login response timing does not enumerate registered email addresses.
 */
export function runDummyPasswordCheck(password: string): void {
  crypto.scryptSync(password || 'invalid', DUMMY_SALT, SCRYPT_KEYLEN, SCRYPT_PARAMS);
}

export function createSessionCredentials(): {
  rawSessionToken: string;
  tokenHash: string;
  rawCsrfToken: string;
  csrfTokenHash: string;
} {
  const rawSessionToken = crypto.randomBytes(32).toString('base64url');
  const rawCsrfToken = crypto.randomBytes(32).toString('base64url');
  return {
    rawSessionToken,
    tokenHash: hashToken(rawSessionToken),
    rawCsrfToken,
    csrfTokenHash: hashToken(rawCsrfToken),
  };
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function verifyTokenHash(rawToken: string, expectedHash: string): boolean {
  if (typeof rawToken !== 'string' || !rawToken || typeof expectedHash !== 'string' || !expectedHash) {
    return false;
  }
  const actual = Buffer.from(hashToken(rawToken), 'hex');
  const expected = Buffer.from(expectedHash, 'hex');
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}

export function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip || 'unknown').digest('hex').slice(0, 16);
}

export function extractClientIp(req: Request): string {
  if (process.env.TRUST_PROXY === 'true') {
    const forwarded = req.headers['x-forwarded-for'];
    if (typeof forwarded === 'string' && forwarded.trim()) {
      return forwarded.split(',')[0].trim();
    }
  }
  return req.socket?.remoteAddress || req.ip || '127.0.0.1';
}

export function isSecureRequest(req: Request): boolean {
  if (req.secure) return true;
  if (process.env.NODE_ENV === 'production') {
    const proto = req.headers['x-forwarded-proto'];
    if (typeof proto === 'string' && proto.split(',')[0].trim() === 'https') {
      return true;
    }
    const host = String(req.headers.host || '');
    if (!host.startsWith('localhost') && !host.startsWith('127.0.0.1')) {
      return true;
    }
  }
  return false;
}

export function parseCookieValue(req: Request, cookieName: string): string | null {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const eqIndex = part.indexOf('=');
    if (eqIndex <= 0) continue;
    const key = part.slice(0, eqIndex).trim();
    if (key === cookieName) {
      const value = part.slice(eqIndex + 1).trim();
      try {
        return decodeURIComponent(value);
      } catch {
        return value;
      }
    }
  }
  return null;
}

export function buildAuthCookies(params: {
  sessionToken: string;
  csrfToken: string;
  secure: boolean;
  maxAgeSeconds?: number;
}): string[] {
  const maxAge = params.maxAgeSeconds ?? SESSION_MAX_AGE_SECONDS;
  const secureFlag = params.secure ? '; Secure' : '';
  return [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(params.sessionToken)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}${secureFlag}`,
    `${CSRF_COOKIE_NAME}=${encodeURIComponent(params.csrfToken)}; SameSite=Lax; Path=/; Max-Age=${maxAge}${secureFlag}`,
  ];
}

export function buildClearAuthCookies(params: {secure: boolean}): string[] {
  const secureFlag = params.secure ? '; Secure' : '';
  return [
    `${SESSION_COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0${secureFlag}`,
    `${CSRF_COOKIE_NAME}=; SameSite=Lax; Path=/; Max-Age=0${secureFlag}`,
  ];
}

/**
 * Persistent rate limiter backed by PostgreSQL (rate_limit_buckets) or dev store.
 */
export function createPersistentRateLimiter(options: {
  repo: CloudRepository;
  scope: string;
  windowMs: number;
  maxRequests: number;
  keyExtractor?: (req: Request) => string;
}) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ipHash = hashIp(extractClientIp(req));
      const extraKey = options.keyExtractor ? options.keyExtractor(req) : '';
      const bucketKey = extraKey
        ? `${options.scope}:${ipHash}:${extraKey}`
        : `${options.scope}:${ipHash}`;

      const result = await options.repo.consumeRateLimit({
        bucketKey,
        windowMs: options.windowMs,
        maxRequests: options.maxRequests,
      });

      res.setHeader('X-RateLimit-Remaining', String(result.remaining));
      res.setHeader('X-RateLimit-Reset', result.resetAt);

      if (!result.allowed) {
        res.status(429).json({
          error: 'RATE_LIMIT_EXCEEDED',
          message: 'Too many requests. Please retry after a short pause.',
        });
        return;
      }
      next();
    } catch {
      res.status(503).json({
        error: 'SERVICE_UNAVAILABLE',
        message: 'Service temporarily unable to validate request rate.',
      });
    }
  };
}
