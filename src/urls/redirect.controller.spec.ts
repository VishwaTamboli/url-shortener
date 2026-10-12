import { ValidationPipe, INestApplication } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import request from 'supertest';
import { Repository } from 'typeorm';
import { AppController } from '../app.controller';
import { Url } from './entities/url.entity';
import { UrlsModule } from './urls.module';

describe('GET /:code redirect (http)', () => {
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
      // Mirror the real AppModule so /health routing is tested too.
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

  it('redirects with 302 + Location for a known code', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/urls')
      .send({ originalUrl: 'https://example.com/landing' })
      .expect(201);

    const res = await request(app.getHttpServer()).get(`/${created.body.shortCode}`).expect(302);
    expect(res.headers.location).toBe('https://example.com/landing');
  });

  it('returns 404 with a generic message for an unknown code', async () => {
    const res = await request(app.getHttpServer()).get('/doesnotexist').expect(404);
    expect(res.body.statusCode).toBe(404);
    // Must not leak SQL / driver details.
    expect(JSON.stringify(res.body)).not.toMatch(/select|query|driver|postgres/i);
  });

  it('does not redirect reserved paths: /health still returns 200', async () => {
    const res = await request(app.getHttpServer()).get('/health').expect(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('increments clicks on each redirect visit', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/urls')
      .send({ originalUrl: 'https://example.com/counted' })
      .expect(201);
    await request(app.getHttpServer()).get(`/${created.body.shortCode}`).expect(302);
    await request(app.getHttpServer()).get(`/${created.body.shortCode}`).expect(302);
    const row = await repo.findOneBy({ shortCode: created.body.shortCode });
    expect(row?.clicks).toBe(2);
  });

  it('unknown redirect changes no click counts', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/urls')
      .send({ originalUrl: 'https://example.com/untouched' })
      .expect(201);
    await request(app.getHttpServer()).get('/doesnotexist').expect(404);
    const row = await repo.findOneBy({ shortCode: created.body.shortCode });
    expect(row?.clicks).toBe(0);
    expect(await repo.count()).toBe(1);
  });

  it('GET /api/urls/:code/stats returns clicks and creation timestamp', async () => {
    const created = await request(app.getHttpServer())
      .post('/api/urls')
      .send({ originalUrl: 'https://example.com/withstats' })
      .expect(201);
    await request(app.getHttpServer()).get(`/${created.body.shortCode}`).expect(302);
    const res = await request(app.getHttpServer())
      .get(`/api/urls/${created.body.shortCode}/stats`)
      .expect(200);
    expect(res.body.shortCode).toBe(created.body.shortCode);
    expect(res.body.originalUrl).toBe('https://example.com/withstats');
    expect(res.body.clicks).toBe(1);
    expect(new Date(res.body.createdAt).getTime()).not.toBeNaN();
  });

  it('GET /api/urls/:code/stats returns 404 for an unknown code', async () => {
    await request(app.getHttpServer()).get('/api/urls/doesnotexist/stats').expect(404);
  });
});
