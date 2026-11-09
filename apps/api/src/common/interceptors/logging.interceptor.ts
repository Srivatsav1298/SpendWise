import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

/** Structured request log: method, path (no query), status, duration, user id. No bodies, no headers. */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');
  intercept(ctx: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = ctx.switchToHttp().getRequest();
    const start = Date.now();
    return next.handle().pipe(
      tap(() => {
        const res = ctx.switchToHttp().getResponse();
        this.logger.log(JSON.stringify({ method: req.method, path: req.path, status: res.statusCode, ms: Date.now() - start, user: req.user?.userId }));
      }),
    );
  }
}
