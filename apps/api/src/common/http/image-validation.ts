import { BadRequestException } from '@nestjs/common';

export const MAX_LOGO_BYTES = 1_000_000;

/**
 * Validates by magic bytes, never by filename or the client-supplied content-type —
 * both are attacker-controlled (SPECS.md §42/README.md "Logo upload"). SVG is
 * deliberately not accepted: it's a script-execution vector when served from the
 * company's own origin.
 */
export function detectImageExtension(buffer: Buffer): 'png' | 'jpg' | 'webp' {
  if (
    buffer.length >= 8 &&
    buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
  ) {
    return 'png';
  }
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'jpg';
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'webp';
  }
  throw new BadRequestException('The file must be a PNG, JPEG, or WebP image.');
}
