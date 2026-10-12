import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { randomBytes } from 'crypto';
import { Repository } from 'typeorm';
import { CreateUrlDto } from './dto/create-url.dto';
import { UrlResponseDto } from './dto/url-response.dto';
import { UrlStatsDto } from './dto/url-stats.dto';
import { Url } from './entities/url.entity';

const BASE62 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const CODE_LENGTH = 7;
const MAX_ATTEMPTS = 5;

export function generateShortCode(length = CODE_LENGTH): string {
  const bytes = randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += BASE62[bytes[i] % 62];
  }
  return code;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: string }).code === '23505'
  );
}

@Injectable()
export class UrlsService {
  constructor(
    @InjectRepository(Url)
    private readonly urls: Repository<Url>,
    private readonly config: ConfigService,
  ) {}

  async create(dto: CreateUrlDto): Promise<UrlResponseDto> {
    const originalUrl = dto.originalUrl?.trim();
    if (!originalUrl || !/^https?:\/\/.+/i.test(originalUrl)) {
      throw new BadRequestException('originalUrl must be a valid URL with http(s) protocol');
    }

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const shortCode = generateShortCode();
      try {
        const row = this.urls.create({ shortCode, originalUrl });
        const saved = await this.urls.save(row);
        return {
          shortCode: saved.shortCode,
          shortUrl: this.buildShortUrl(saved.shortCode),
          originalUrl: saved.originalUrl,
        };
      } catch (error) {
        if (isUniqueViolation(error) && attempt < MAX_ATTEMPTS) {
          continue; // collision: retry with a fresh random code
        }
        if (isUniqueViolation(error)) {
          throw new ConflictException('Could not generate a unique short code, please retry');
        }
        throw error;
      }
    }
    throw new ConflictException('Could not generate a unique short code, please retry');
  }

  private buildShortUrl(shortCode: string): string {
    const baseUrl = this.config.get<string>('BASE_URL', 'http://localhost:3000');
    return `${baseUrl.replace(/\/$/, '')}/${shortCode}`;
  }

  /**
   * Atomically increment the click count and return the original URL.
   * A single UPDATE ... RETURNING statement keeps the increment safe under
   * concurrent requests (no read-modify-write lost updates). Unknown codes
   * match zero rows, so nothing is incremented and a 404 is thrown.
   */
  async resolve(code: string): Promise<string> {
    const result = await this.urls
      .createQueryBuilder()
      .update(Url)
      .set({ clicks: () => '"clicks" + 1' })
      .where('"shortCode" = :code', { code })
      .returning('"originalUrl"')
      .execute();
    const raw = Array.isArray(result.raw) ? result.raw[0] : undefined;
    const originalUrl = raw?.originalUrl as string | undefined;
    if (!originalUrl) {
      throw new NotFoundException('Short URL not found');
    }
    return originalUrl;
  }

  async getStats(code: string): Promise<UrlStatsDto> {
    const row = await this.urls.findOneBy({ shortCode: code });
    if (!row) {
      throw new NotFoundException('Short URL not found');
    }
    return {
      shortCode: row.shortCode,
      originalUrl: row.originalUrl,
      clicks: row.clicks,
      createdAt: row.createdAt,
    };
  }
}
