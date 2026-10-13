import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Url } from './entities/url.entity';
import { RedirectController } from './redirect.controller';
import { UrlCacheService } from './url-cache.service';
import { UrlsController } from './urls.controller';
import { UrlsService } from './urls.service';

@Module({
  imports: [TypeOrmModule.forFeature([Url]), ConfigModule],
  controllers: [UrlsController, RedirectController],
  providers: [UrlsService, UrlCacheService],
  exports: [UrlsService, UrlCacheService],
})
export class UrlsModule {}
