import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { ZodSchema } from 'zod';
import { ZodValidationPipe } from './zod-validation.pipe';

/**
 * `@ZodBody(schema)` — validates `req.body` against a packages/contracts schema and
 * returns the parsed, typed value. A thin wrapper so controllers do not repeat
 * `@Body(new ZodValidationPipe(schema))` everywhere.
 */
export const ZodBody = createParamDecorator((schema: ZodSchema, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return new ZodValidationPipe(schema).transform(request.body);
});
