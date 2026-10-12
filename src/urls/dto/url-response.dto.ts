import { ApiProperty } from '@nestjs/swagger';

export class UrlResponseDto {
  @ApiProperty({ example: 'aB3x9Qz', description: 'Unique 7-character Base62 short code' })
  shortCode: string;

  @ApiProperty({ example: 'http://localhost:3000/aB3x9Qz' })
  shortUrl: string;

  @ApiProperty({ example: 'https://example.com/very/long/url' })
  originalUrl: string;
}
