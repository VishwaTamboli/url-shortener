import { ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { Url } from './entities/url.entity';
import { UrlsModule } from './urls.module';
import { Repository } from 'typeorm';

describe('POST /api/urls (http)', () => {
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

  it('returns 201 with shortCode and shortUrl for a valid URL', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/urls')
      .send({ originalUrl: 'https://example.com/hello' })
      .expect(201);
    expect(res.body.shortCode).toMatch(/^[0-9A-Za-z]{7}$/);
    expect(res.body.originalUrl).toBe('https://example.com/hello');
    expect(res.body.shortUrl).toContain(res.body.shortCode);
  });

  it('returns 400 for an invalid URL', async () => {
    await request(app.getHttpServer())
      .post('/api/urls')
      .send({ originalUrl: 'not-a-url' })
      .expect(400);
  });

  it('returns 400 for a missing body field', async () => {
    await request(app.getHttpServer()).post('/api/urls').send({}).expect(400);
  });
});
