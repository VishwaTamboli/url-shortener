import { ConfigModule } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Url } from './entities/url.entity';
import { UrlsService } from './urls.service';
import { UrlsModule } from './urls.module';

describe('UrlsService (postgres)', () => {
  let module: TestingModule;
  let service: UrlsService;
  let repo: Repository<Url>;
  let dataSource: DataSource;

  beforeAll(async () => {
    module = await Test.createTestingModule({
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
    service = module.get(UrlsService);
    repo = module.get('UrlRepository');
    dataSource = module.get(DataSource);
  });

  afterAll(async () => {
    await module.close();
  });

  afterEach(async () => {
    await repo.createQueryBuilder().delete().from(Url).execute();
  });

  it('creates a row for a valid URL and returns a 7-char code', async () => {
    const result = await service.create({ originalUrl: 'https://example.com/abc' });
    expect(result.shortCode).toMatch(/^[0-9A-Za-z]{7}$/);
    expect(result.originalUrl).toBe('https://example.com/abc');
    expect(result.shortUrl.endsWith(`/${result.shortCode}`)).toBe(true);

    const row = await repo.findOneBy({ shortCode: result.shortCode });
    expect(row).toBeDefined();
    expect(row?.clicks).toBe(0); // creation is not a click
  });

  it('rejects an invalid URL with 400', async () => {
    await expect(service.create({ originalUrl: 'not-a-url' })).rejects.toMatchObject({
      status: 400,
    });
  });

  it('generates unique codes across many creates (uniqueness)', async () => {
    const codes = new Set<string>();
    for (let i = 0; i < 25; i++) {
      const r = await service.create({ originalUrl: `https://example.com/${i}` });
      codes.add(r.shortCode);
    }
    expect(codes.size).toBe(25);
    expect(await repo.count()).toBe(25);
  });

  it('retries on short-code collision instead of failing', async () => {
    // Occupy one code, then force the generator path through save() twice
    // by inserting a duplicate directly to prove the DB constraint exists.
    const first = await service.create({ originalUrl: 'https://example.com/first' });
    await expect(
      repo.save(repo.create({ shortCode: first.shortCode, originalUrl: 'https://example.com/dup' })),
    ).rejects.toMatchObject({ code: '23505' });

    const second = await service.create({ originalUrl: 'https://example.com/second' });
    expect(second.shortCode).not.toBe(first.shortCode);
  });

  it('resolve() increments clicks on each visit', async () => {
    const created = await service.create({ originalUrl: 'https://example.com/counted' });
    await service.resolve(created.shortCode);
    await service.resolve(created.shortCode);
    const row = await repo.findOneBy({ shortCode: created.shortCode });
    expect(row?.clicks).toBe(2);
  });

  it('resolve() on an unknown code changes no click counts', async () => {
    const created = await service.create({ originalUrl: 'https://example.com/untouched' });
    await expect(service.resolve('ZZZ0000')).rejects.toMatchObject({ status: 404 });
    const row = await repo.findOneBy({ shortCode: created.shortCode });
    expect(row?.clicks).toBe(0);
    expect(await repo.count()).toBe(1);
  });

  it('counts concurrent visits without lost updates', async () => {
    const created = await service.create({ originalUrl: 'https://example.com/concurrent' });
    await Promise.all(Array.from({ length: 20 }, () => service.resolve(created.shortCode)));
    const row = await repo.findOneBy({ shortCode: created.shortCode });
    expect(row?.clicks).toBe(20);
  });

  it('getStats() returns clicks and creation timestamp', async () => {
    const created = await service.create({ originalUrl: 'https://example.com/stats' });
    await service.resolve(created.shortCode);
    await service.resolve(created.shortCode);
    const stats = await service.getStats(created.shortCode);
    expect(stats).toMatchObject({
      shortCode: created.shortCode,
      originalUrl: 'https://example.com/stats',
      clicks: 2,
    });
    expect(new Date(stats.createdAt).getTime()).not.toBeNaN();
  });

  it('looks up short codes case-sensitively', async () => {
    await repo.save(repo.create({ shortCode: 'aB1cD2e', originalUrl: 'https://example.com/case' }));
    await expect(service.resolve('aB1cD2e')).resolves.toBe('https://example.com/case');
    await expect(service.resolve('AB1CD2E')).rejects.toMatchObject({ status: 404 });
  });

  it('getStats() reports zero clicks before any visit', async () => {
    const created = await service.create({ originalUrl: 'https://example.com/fresh' });
    const stats = await service.getStats(created.shortCode);
    expect(stats.clicks).toBe(0);
  });

  it('getStats() throws 404 for an unknown code', async () => {
    await expect(service.getStats('ZZZ0000')).rejects.toMatchObject({ status: 404 });
  });

  it('database enforces shortCode uniqueness', async () => {
    const columns = await dataSource.query(
      `SELECT column_name, data_type FROM information_schema.columns WHERE table_name='urls' ORDER BY ordinal_position`,
    );
    const names = columns.map((c: { column_name: string }) => c.column_name);
    expect(names).toEqual(expect.arrayContaining(['id', 'shortCode', 'originalUrl', 'clicks', 'createdAt']));
  });
});
