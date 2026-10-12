import { ApiProperty } from '@nestjs/swagger';

export class UrlStatsDto {
  @ApiProperty({ example: 'aB3x9Qz' })
  shortCode: string;

  @ApiProperty({ example: 'https://example.com/very/long/url' })
  originalUrl: string;

  @ApiProperty({ example: 42, description: 'Redirect visits; creating the URL is not counted' })
  clicks: number;

  @ApiProperty({ example: '2026-10-11T14:41:01.830Z' })
  createdAt: Date;
}
