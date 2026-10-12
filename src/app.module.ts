import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { UrlsModule } from './urls/urls.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        type: 'postgres',
        host: config.get<string>('DB_HOST', 'localhost'),
        port: config.get<number>('DB_PORT', 5432),
        username: config.get<string>('DB_USERNAME', 'vishwa'),
        password: config.get<string>('DB_PASSWORD', ''),
        database: config.get<string>('DB_NAME', 'url_shortener'),
        autoLoadEntities: true,
        // Never auto-sync schema in production. Use migrations (Phase 2+).
        synchronize: config.get<string>('TYPEORM_SYNC', 'false') === 'true',
        // Neon and other hosted Postgres providers require TLS.
        // Enable with DB_SSL=true; leave unset for local trust-auth Postgres.
        ssl: config.get<string>('DB_SSL', 'false') === 'true' ? { rejectUnauthorized: false } : undefined,
        logging: false,
      }),
    }),
    UrlsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
