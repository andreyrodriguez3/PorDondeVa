import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * Every error response carries the { error: { code, message, details? } } envelope
 * (SPECS.md §34 — errors must be explicit and actionable, never silently swallowed).
 */
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const body = exception instanceof HttpException ? exception.getResponse() : null;

    if (body && typeof body === 'object' && 'error' in body) {
      response.status(status).json(body);
      return;
    }

    const message =
      exception instanceof HttpException
        ? (typeof body === 'string' ? body : (body as { message?: string })?.message) ||
          exception.message
        : 'Internal server error';

    if (status >= 500) {
      this.logger.error(`${request.method} ${request.url} -> ${status}`, exception as Error);
    }

    response.status(status).json({
      error: {
        code: HttpStatus[status] ?? 'INTERNAL_SERVER_ERROR',
        message,
      },
    });
  }
}
