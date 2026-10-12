import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsUrl, MaxLength } from 'class-validator';

export class CreateUrlDto {
  @ApiProperty({
    example: 'https://example.com/very/long/url',
    description: 'Original URL including the http(s) protocol',
    maxLength: 2048,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsNotEmpty({ message: 'originalUrl must not be empty' })
  @IsUrl({ require_protocol: true }, { message: 'originalUrl must be a valid URL with http(s) protocol' })
  @MaxLength(2048, { message: 'originalUrl is too long' })
  originalUrl: string;
}
