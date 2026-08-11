import { BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodSchema } from 'zod';

/**
 * Bridges packages/contracts' Zod schemas into Nest's pipe pipeline (ROADMAP.md §5,
 * common/zod/). The API validates against the same schema the web app infers its types
 * from, so a contract change breaks the build rather than production.
 */
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Request body failed validation.',
          details: result.error.flatten(),
        },
      });
    }
    return result.data;
  }
}
