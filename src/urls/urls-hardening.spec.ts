import { ValidationPipe, INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppController } from '../app.controller';
import { Url } from './entities/url.entity';
import { UrlsModule } from './urls.module';

function leakCheck(body: unknown): void {
  // Responses must never include SQL, driver errors, or stack traces.
  expect(JSON.stringify(body)).not.toMatch(/select\s|insert\s|query\sfailed|driver|pg:|stack|at\s+.*\.ts:/i);
}

describe('validation hardening (http)', () => {
  let app: INestApplication;
  let repo: Repository<Url>;

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
      controllers: [AppController],
    }).compile();
    app = module.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    repo = module.get('UrlRepository');
  });

  afterAll(async () => {
    await app?.close();
  });

  afterEach(async () => {
    await repo.createQueryBuilder().delete().from(Url).execute();
  });

  it('returns 404 for an overlong short code', async () => {
    const res = await request(app.getHttpServer()).get(`/${'a'.repeat(100)}`).expect(404);
    leakCheck(res.body);
  });

  it('returns 404 for a code with special characters', async () => {
    const res = await request(app.getHttpServer()).get('/ab%20c!!').expect(404);
    leakCheck(res.body);
  });

  it('returns 400 for a non-string originalUrl', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/urls')
      .send({ originalUrl: 12345 })
      .expect(400);
    expect(res.body.message).toBeDefined();
  });

  it('returns 400 for a null originalUrl', async () => {
    await request(app.getHttpServer()).post('/api/urls').send({ originalUrl: null }).expect(400);
  });

  it('returns 400 for unknown extra fields', async () => {
    await request(app.getHttpServer())
      .post('/api/urls')
      .send({ originalUrl: 'https://example.com/x', evil: '1' })
      .expect(400);
  });

  it('returns 400 for non-http(s) protocols such as ftp', async () => {
    await request(app.getHttpServer())
      .post('/api/urls')
      .send({ originalUrl: 'ftp://example.com/file' })
      .expect(400);
  });

  it('returns 400 for javascript: URLs', async () => {
    await request(app.getHttpServer())
      .post('/api/urls')
      .send({ originalUrl: 'javascript:alert(1)' })
      .expect(400);
  });

  it('accepts a padded URL and stores it trimmed', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/urls')
      .send({ originalUrl: '  https://example.com/padded  ' })
      .expect(201);
    expect(res.body.originalUrl).toBe('https://example.com/padded');
    const row = await repo.findOneBy({ shortCode: res.body.shortCode });
    expect(row?.originalUrl).toBe('https://example.com/padded');
  });

  it('counts concurrent HTTP redirects accurately', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/urls')
      .send({ originalUrl: 'https://example.com/flash' })
      .expect(201);
    await Promise.all(
      Array.from({ length: 10 }, () =>
        request(app.getHttpServer()).get(`/${created.body.shortCode}`).expect(302),
      ),
    );
    const stats = await request(app.getHttpServer())
      .get(`/api/urls/${created.body.shortCode}/stats`)
      .expect(200);
    expect(stats.body.clicks).toBe(10);
  });
});
