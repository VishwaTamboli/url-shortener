import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

/** Redis key for a shortCode -> originalUrl lookup. */
export function cacheKey(code: string): string {
  return `url:${code}`;
}

function parseTtlSeconds(raw: string | undefined): number {
  const seconds = Number(raw ?? '3600');
  return Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 3600;
}

/**
 * Small best-effort cache for shortCode -> originalUrl.
 * PostgreSQL stays the source of truth: every method fails open
 * (returns null / resolves void) when Redis is unavailable, so callers
 * always fall back to the database. Never throws.
 */
@Injectable()
export class UrlCacheService implements OnModuleDestroy {
  private readonly logger = new Logger(UrlCacheService.name);
  private readonly redis: Redis;
  private readonly ttlSeconds: number;
  private warned = false;

  constructor(private readonly config: ConfigService) {
    const url = config.get<string>('REDIS_URL', 'redis://localhost:6379');
    this.ttlSeconds = parseTtlSeconds(config.get<string>('REDIS_TTL_SECONDS'));
    this.redis = new Redis(url, {
      lazyConnect: true,
      // Fail fast when Redis is down instead of queueing commands.
      enableOfflineQueue: false,
      connectTimeout: 1000,
      maxRetriesPerRequest: 1,
    });
    // ioredis emits 'error' on connection failures; handle it so the
    // process never crashes and the caller fails open to PostgreSQL.
    this.redis.on('error', () => this.warnOnce('Redis error; failing open to PostgreSQL'));
  }

  async onModuleDestroy(): Promise<void> {
    try {
      this.redis.disconnect();
    } catch {
      // Ignore shutdown errors.
    }
  }

  /** Cached originalUrl, or null on miss / Redis failure. */
  async getUrl(code: string): Promise<string | null> {
    try {
      const value = await this.redis.get(cacheKey(code));
      return typeof value === 'string' && value.length > 0 ? value : null;
    } catch {
      this.warnOnce('Redis GET failed; failing open to PostgreSQL');
      return null;
    }
  }

  /** Best-effort SETEX. Callers must never pass unknown codes here. */
  async setUrl(code: string, originalUrl: string): Promise<void> {
    try {
      await this.redis.set(cacheKey(code), originalUrl, 'EX', this.ttlSeconds);
    } catch {
      this.warnOnce('Redis SET failed; continuing without cache');
    }
  }

  /** Best-effort DEL for stale keys. */
  async delUrl(code: string): Promise<void> {
    try {
      await this.redis.del(cacheKey(code));
    } catch {
      // Fail open: a stale key expires via TTL.
    }
  }

  private warnOnce(message: string): void {
    if (!this.warned) {
      this.warned = true;
      this.logger.warn(message);
    }
  }
}
