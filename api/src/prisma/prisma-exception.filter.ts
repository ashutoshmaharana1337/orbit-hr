import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

/**
 * Translates Prisma's known request errors into HTTP responses so a duplicate
 * key or dangling FK surfaces as a client error instead of an opaque 500.
 */
@Catch(Prisma.PrismaClientKnownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: Prisma.PrismaClientKnownRequestError, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const http = this.toHttpException(exception);
    response.status(http.getStatus()).json(http.getResponse());
  }

  private toHttpException(exception: Prisma.PrismaClientKnownRequestError): HttpException {
    switch (exception.code) {
      case 'P2002': {
        // `target` is null for partial/raw indexes Prisma doesn't model (e.g. Employee email
        // unique among non-deleted rows), so fall back to naming the model.
        const target = exception.meta?.target;
        const fields = Array.isArray(target) ? target.join(', ') : typeof target === 'string' ? target : undefined;
        const model = typeof exception.meta?.modelName === 'string' ? exception.meta.modelName : 'Record';
        return new ConflictException(
          fields ? `A record with this ${fields} already exists` : `${model}: a record with these values already exists`,
        );
      }
      case 'P2003':
        return new BadRequestException('Referenced record does not exist');
      case 'P2025':
        return new NotFoundException('Record not found');
      default:
        // Never leak the Prisma message; the logger interceptor already has the original.
        return new InternalServerErrorException();
    }
  }
}
