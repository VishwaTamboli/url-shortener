import { readFileSync } from 'fs';
import { join } from 'path';
import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { AppModule } from './app.module';

describe('configuration safety', () => {
  let module: TestingModule;

  beforeAll(async () => {
    module = await Test.createTestingModule({ imports: [AppModule] }).compile();
  });

  afterAll(async () => {
    await module?.close();
  });

  it('does not enable TypeORM schema synchronization', async () => {
    const dataSource = module.get(DataSource);
    expect(dataSource.options.synchronize).toBe(false);
  });

  it('.env.example documents required vars without secrets', () => {
    const example = readFileSync(join(__dirname, '..', '.env.example'), 'utf8');
    for (const key of ['DB_HOST', 'DB_PORT', 'DB_USERNAME', 'DB_NAME', 'BASE_URL']) {
      expect(example).toContain(key);
    }
    const passwordLine = example.split('\n').find((l) => l.startsWith('DB_PASSWORD='));
    expect(passwordLine).toBe('DB_PASSWORD=');
  });
});
