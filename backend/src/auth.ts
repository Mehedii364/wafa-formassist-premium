import crypto from 'node:crypto';
import type {NextFunction, Request, Response} from 'express';

export function hashPassword(password: string): {hash: string; salt: string} {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return {hash: derived, salt};
}

export function verifyPassword(password: string, hash: string, salt: string): boolean {
  const derived = crypto.scryptSync(password, salt, 64);
  const stored = Buffer.from(hash, 'hex');
  if (derived.length !== stored.length) return false;
  return crypto.timingSafeEqual(derived, stored);
}

export function createSessionToken(): {rawToken: string; tokenHash: string} {
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(rawToken);
  return {rawToken, tokenHash};
}

export function hashToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

export function hashIp(ip: string): string {
  return crypto.createHash('sha256').update(ip || 'unknown').digest('hex').slice(0, 16);
}

/**
 * Sliding-window in-memory rate limiter for cloud API endpoints.
 */
export function createRateLimiter(options: {windowMs: number; maxRequests: number}) {
  const buckets = new Map<string, number[]>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = `${req.ip || 'local'}:${req.path}`;
    const now = Date.now();
    const cutoff = now - options.windowMs;
    const recent = (buckets.get(key) || []).filter((ts) => ts > cutoff);

    if (recent.length >= options.maxRequests) {
      res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many requests. Please retry after a short pause.',
      });
      return;
    }

    recent.push(now);
    buckets.set(key, recent);
    next();
  };
}
