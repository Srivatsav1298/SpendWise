import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/** Wraps every successful response as { data, meta? }. Services may return { items, meta }. */
@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  intercept(_: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle().pipe(
      map((body) => {
        if (body === undefined || body === null) return { data: null };
        if (body && typeof body === 'object' && 'items' in body && 'meta' in body) {
          return { data: (body as any).items, meta: (body as any).meta };
        }
        if (body && typeof body === 'object' && (body as any).__raw) return (body as any).value;
        return { data: body };
      }),
    );
  }
}
