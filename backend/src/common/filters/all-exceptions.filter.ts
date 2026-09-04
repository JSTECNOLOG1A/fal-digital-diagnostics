import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request & { requestId?: string }>();

    const isHttp = exception instanceof HttpException;
    const status = isHttp
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse = isHttp ? exception.getResponse() : null;
    const message =
      typeof exceptionResponse === 'string'
        ? exceptionResponse
        : (exceptionResponse as { message?: string | string[] } | null)?.message ??
          'Internal server error';

    if (status >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    // Alguns endpoints lançam HttpException com um objeto de payload rico
    // (ex.: publish() anexa `pendencias`/`coverage`, swapFalQuestion anexa
    // `swap_record`/`original_question_id`) — preserva esses campos extras
    // no corpo da resposta em vez de descartá-los, mantendo o contrato
    // {statusCode, message, path, requestId, timestamp} por cima.
    const body: Record<string, unknown> =
      exceptionResponse && typeof exceptionResponse === 'object'
        ? { ...(exceptionResponse as Record<string, unknown>) }
        : {};

    body.statusCode = status;
    body.message = message;
    body.path = request.url;
    body.requestId = request.requestId;
    body.timestamp = new Date().toISOString();

    if (process.env.NODE_ENV !== 'production' && exception instanceof Error && status >= 500) {
      body.error = exception.message;
    }

    response.status(status).json(body);
  }
}
