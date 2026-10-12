import 'reflect-metadata';
import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

// Used by the TypeORM CLI for safe migrations.
// Never enable synchronize here in production.
// NOTE: exactly one DataSource export (CLI requirement).
const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: process.env.DB_PORT ? Number(process.env.DB_PORT) : 5432,
  username: process.env.DB_USERNAME ?? 'vishwa',
  password: process.env.DB_PASSWORD || undefined,
  database: process.env.DB_NAME ?? 'url_shortener',
  entities: ['src/**/*.entity.ts'],
  migrations: ['src/migrations/*.ts'],
  synchronize: false,
  // Neon and other hosted Postgres providers require TLS (DB_SSL=true).
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
  logging: false,
});

export default AppDataSource;
