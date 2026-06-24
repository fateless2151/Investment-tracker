import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

interface ResponseLike {
  status(code: number): { json(body: unknown): unknown };
}
interface RequestLike {
  url: string;
}

/**
 * Catches every exception and returns a consistent JSON error shape:
 * `{ statusCode, error, message, path, timestamp }`.
 *
 * HttpExceptions keep their status/message (e.g. validation errors). Any other
 * (unexpected) error is logged server-side and reported as a generic 500 so we
 * never leak stack traces or internals to clients.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger('ExceptionFilter');

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<ResponseLike>();
    const request = ctx.getRequest<RequestLike>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message: string | string[] = 'Internal server error';
    let error = 'InternalServerError';

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const res = exception.getResponse();
      if (typeof res === 'string') {
        message = res;
        error = exception.name;
      } else {
        const body = res as { message?: string | string[]; error?: string };
        message = body.message ?? exception.message;
        error = body.error ?? exception.name;
      }
    } else {
      this.logger.error(
        (exception as Error)?.message ?? 'Unknown error',
        (exception as Error)?.stack,
      );
    }

    response.status(status).json({
      statusCode: status,
      error,
      message,
      path: request.url,
      timestamp: new Date().toISOString(),
    });
  }
}
