import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const status =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const message =
      exception instanceof HttpException
        ? exception.getResponse()
        : 'Internal server error';

    // Keep 5xx diagnostics in Render logs without recording request bodies,
    // credentials, tokens or other user-submitted data.
    if (status >= 500) {
      const detail = exception instanceof Error
        ? `${exception.name}: ${exception.message}`
        : String(exception);
      console.error(`[http-exception] ${request.method} ${request.originalUrl} -> ${status}: ${detail}`);
      if (exception instanceof Error && exception.stack) {
        console.error(exception.stack);
      }
    }

    response.status(status).json({
      success: false,
      statusCode: status,
      message:
        typeof message === 'object' && 'message' in (message as object)
          ? (message as { message: string }).message
          : message,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
