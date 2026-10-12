import { validate } from 'class-validator';
import { CreateUrlDto } from './create-url.dto';

describe('CreateUrlDto', () => {
  async function validateUrl(payload: Record<string, unknown>) {
    const dto = Object.assign(new CreateUrlDto(), payload);
    return validate(dto);
  }

  it('accepts a valid https URL', async () => {
    const errors = await validateUrl({ originalUrl: 'https://example.com/long/path?q=1' });
    expect(errors).toHaveLength(0);
  });

  it('rejects a missing originalUrl', async () => {
    const errors = await validateUrl({});
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a non-URL string', async () => {
    const errors = await validateUrl({ originalUrl: 'not-a-url' });
    expect(errors.length).toBeGreaterThan(0);
  });

  it('rejects a URL without protocol', async () => {
    const errors = await validateUrl({ originalUrl: 'example.com/path' });
    expect(errors.length).toBeGreaterThan(0);
  });
});
