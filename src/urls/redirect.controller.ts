import { Controller, Get, Param, Res } from '@nestjs/common';
import {
  ApiFoundResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { UrlsService } from './urls.service';

/**
 * Root-level redirect route (GET /:code).
 * Registered after AppController, so GET /health keeps working.
 * Each visit atomically increments clicks inside UrlsService.resolve().
 */
@ApiTags('redirect')
@Controller()
export class RedirectController {
  constructor(private readonly urlsService: UrlsService) {}

  @Get(':code')
  @ApiOperation({ summary: 'Redirect to the original URL and count one click' })
  @ApiParam({ name: 'code', example: 'aB3x9Qz' })
  @ApiFoundResponse({ description: '302 redirect; the Location header holds the original URL' })
  @ApiNotFoundResponse({ description: 'Short code does not exist' })
  async redirect(@Param('code') code: string, @Res() res: Response): Promise<void> {
    const originalUrl = await this.urlsService.resolve(code);
    res.redirect(302, originalUrl);
  }
}
