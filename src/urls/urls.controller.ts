import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { CreateUrlDto } from './dto/create-url.dto';
import { UrlResponseDto } from './dto/url-response.dto';
import { UrlStatsDto } from './dto/url-stats.dto';
import { UrlsService } from './urls.service';

@ApiTags('urls')
@Controller('api/urls')
export class UrlsController {
  constructor(private readonly urlsService: UrlsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a shortened URL' })
  @ApiCreatedResponse({ description: 'Short URL created', type: UrlResponseDto })
  @ApiBadRequestResponse({ description: 'originalUrl is missing or not a valid http(s) URL' })
  create(@Body() dto: CreateUrlDto): Promise<UrlResponseDto> {
    return this.urlsService.create(dto);
  }

  @Get(':code/stats')
  @ApiOperation({ summary: 'Get click statistics for a short code' })
  @ApiParam({ name: 'code', example: 'aB3x9Qz' })
  @ApiOkResponse({ description: 'Statistics for the short code', type: UrlStatsDto })
  @ApiNotFoundResponse({ description: 'Short code does not exist' })
  getStats(@Param('code') code: string): Promise<UrlStatsDto> {
    return this.urlsService.getStats(code);
  }
}
