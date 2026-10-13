import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { QueryFailedError } from 'typeorm';
import { INestApplication } from '@nestjs/common';
import { Url } from './entities/url.entity';
import { UrlsController } from './urls.controller';
import { RedirectController } from './redirect.controller';
import { UrlCacheService } from './url-cache.service';
import { UrlsService } from './urls.service';

function expectNoLeak(body: unknown): void {
  const text = JSON.stringify(body);
  expect(text).not.toMatch(/select\s|insert\s|ECONNREFUSED|timeout expired|driver|stack|boom/i);
}

/**
 * Simulates a broken database: every repository call throws.
 * API responses must be generic 500s with no SQL, credentials, or stacks.
 */
describe('database failure responses (http, mocked repo)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const sqlError = new QueryFailedError(
      'INSERT INTO "urls"("shortCode") VALUES ($1)',
      ['abc1234'],
      new Error('boom: password authentication failed for user "vishwa"'),
    );
    const throwingRepo = {
      create: jest.fn().mockReturnValue({}),
      save: jest.fn().mockRejectedValue(sqlError),
      findOneBy: jest.fn().mockRejectedValue(new Error('timeout expired after 1000ms')),
      createQueryBuilder: jest.fn().mockImplementation(() => {
        throw new Error('connect ECONNREFUSED 127.0.0.1:5432');
      }),
    };
    const module = await Test.createTestingModule({
      controllers: [UrlsController, RedirectController],
      providers: [
        UrlsService,
        { provide: getRepositoryToken(Url), useValue: throwingRepo },
        { provide: ConfigService, useValue: { get: (_k: string, d?: unknown) => d } },
        // Cache disabled here: the DB-failure behavior must not depend on Redis.
        {
          provide: UrlCacheService,
          useValue: { getUrl: async () => null, setUrl: async () => undefined, delUrl: async () => undefined },
        },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app?.close();
  });

  it('POST /api/urls returns generic 500 without internals', async () => {
    const res = await request(app.getHttpServer())
      .post('/api/urls')
      .send({ originalUrl: 'https://example.com/ok' })
      .expect(500);
    expect(res.body.statusCode).toBe(500);
    expectNoLeak(res.body);
  });

  it('GET /:code returns generic 500 without internals', async () => {
    const res = await request(app.getHttpServer()).get('/anycode1').expect(500);
    expect(res.body.statusCode).toBe(500);
    expectNoLeak(res.body);
  });

  it('GET /api/urls/:code/stats returns generic 500 without internals', async () => {
    const res = await request(app.getHttpServer()).get('/api/urls/anycode1/stats').expect(500);
    expect(res.body.statusCode).toBe(500);
    expectNoLeak(res.body);
  });
});
