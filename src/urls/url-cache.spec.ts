import { ValidationPipe, INestApplication } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import Redis from 'ioredis';
import request from 'supertest';
import { Repository } from 'typeorm';
import { Url } from './entities/url.entity';
import { UrlCacheService, cacheKey } from './url-cache.service';
import { UrlsModule } from './urls.module';
import { UrlsService } from './urls.service';

/**
 * Phase 3 Redis cache behavior (http + service level).
 *
 * Requires REDIS_URL to point at a throwaway Redis database
 * (e.g. redis://localhost:6379/15); afterEach flushes ONLY that index.
 * PostgreSQL target comes from DB_* env (isolated test database).
 */
describe('redirect Redis cache (http)', () => {
  let app: INestApplication;
  let repo: Repository<Url>;
  let service: UrlsService;
  let cache: UrlCacheService;
  let probe: Redis;

  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379/15';

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: process.env.DB_HOST ?? 'localhost',
          port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
          username: process.env.DB_USERNAME ?? 'vishwa',
          password: process.env.DB_PASSWORD || undefined,
          database: process.env.DB_NAME ?? 'url_shortener',
          autoLoadEntities: true,
          synchronize: false,
        }),
        UrlsModule,
      ],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    repo = module.get('UrlRepository');
    service = module.get(UrlsService);
    cache = module.get(UrlCacheService);
    probe = new Redis(redisUrl, { lazyConnect: true });
  });

  afterAll(async () => {
    probe.disconnect();
    await app?.close();
  });

  afterEach(async () => {
    await repo.createQueryBuilder().delete().from(Url).execute();
    await probe.flushdb(); // throwaway Redis index only
  });

  async function createCode(suffix: string): Promise<string> {
    const created = await request(app.getHttpServer())
      .post('/api/urls')
      .send({ originalUrl: `https://example.com/cache-${suffix}` })
      .expect(201);
    return created.body.shortCode as string;
  }

  it('cache miss populates Redis with a TTL', async () => {
    const code = await createCode('miss');
    expect(await cache.getUrl(code)).toBeNull();

    await request(app.getHttpServer()).get(`/${code}`).expect(302);

    expect(await cache.getUrl(code)).toBe('https://example.com/cache-miss');
    const ttl = await probe.ttl(cacheKey(code));
    expect(ttl).toBeGreaterThan(0);
    expect(ttl).toBeLessThanOrEqual(3600);
  });

  it('cache hit still returns 302 and increments clicks exactly', async () => {
    const code = await createCode('hit');
    await request(app.getHttpServer()).get(`/${code}`).expect(302); // miss, populates
    const hit = await request(app.getHttpServer()).get(`/${code}`).expect(302); // hit
    expect(hit.headers.location).toBe('https://example.com/cache-hit');

    const row = await repo.findOneBy({ shortCode: code });
    expect(row?.clicks).toBe(2);
    const stats = await request(app.getHttpServer())
      .get(`/api/urls/${code}/stats`)
      .expect(200);
    expect(stats.body.clicks).toBe(2);
  });

  it('unknown codes return 404 and are never cached', async () => {
    await request(app.getHttpServer()).get('/cache-missing-1').expect(404);
    expect(await cache.getUrl('cache-missing-1')).toBeNull();
    expect(await probe.exists(cacheKey('cache-missing-1'))).toBe(0);
  });

  it('fails open to PostgreSQL when Redis is unavailable', async () => {
    const code = await createCode('fallback');
    const deadCache = new UrlCacheService(
      { get: (key: string, fallback?: unknown) =>
        key === 'REDIS_URL' ? 'redis://localhost:6399' : fallback,
      } as ConfigService,
    );
    const fallbackService = new UrlsService(
      repo,
      { get: (_k: string, d?: unknown) => d } as ConfigService,
      deadCache,
    );

    // Miss path with Redis down: correct URL, clicks counted, nothing throws.
    await expect(fallbackService.resolve(code)).resolves.toBe(
      'https://example.com/cache-fallback',
    );
    // Hit path with Redis down (cache unreadable): same behavior.
    await expect(fallbackService.resolve(code)).resolves.toBe(
      'https://example.com/cache-fallback',
    );
    const row = await repo.findOneBy({ shortCode: code });
    expect(row?.clicks).toBe(2);
    // Unknown code with Redis down: still a 404, not a 500.
    await expect(fallbackService.resolve('cache-missing-2')).rejects.toThrow(
      'Short URL not found',
    );
    await deadCache.onModuleDestroy();
  });

  it('service-level hit uses the cached URL and counts the click', async () => {
    const code = await createCode('direct');
    expect(await service.resolve(code)).toBe('https://example.com/cache-direct'); // miss
    expect(await service.resolve(code)).toBe('https://example.com/cache-direct'); // hit
    const row = await repo.findOneBy({ shortCode: code });
    expect(row?.clicks).toBe(2);
  });
});
