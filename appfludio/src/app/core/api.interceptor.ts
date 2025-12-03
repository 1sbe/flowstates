import { Injectable } from '@angular/core';
import {
  HttpInterceptor,
  HttpRequest,
  HttpHandler,
  HttpEvent,
  HttpErrorResponse
} from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, filter, take, switchMap } from 'rxjs/operators';
import { AuthService } from './auth.service';

@Injectable()
export class ApiInterceptor implements HttpInterceptor {
  private refreshing = false;
  private refreshSubject = new BehaviorSubject<string | null>(null);

  constructor(private auth: AuthService) {}

  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    const access = this.auth.getAccessToken();
    let authReq = req;
    if (access) {
      authReq = req.clone({
        setHeaders: { Authorization: `Bearer ${access}` }
      });
    }

    return next.handle(authReq).pipe(
      catchError(err => {
        if (err instanceof HttpErrorResponse && err.status === 401) {
          // Try refresh once
          return this.tryRefreshTokenAndRepeat(authReq, next);
        }
        return throwError(() => err);
      })
    );
  }

  private tryRefreshTokenAndRepeat(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if (this.refreshing) {
      // Wait for the in-flight refresh to finish and then retry
      return this.refreshSubject.pipe(
        filter((token): token is string => token != null),
        take(1),
        switchMap((token) => {
          const cloned = req.clone({ setHeaders: { Authorization: `Bearer ${token}` }});
          return next.handle(cloned);
        })
      );
    } else {
      this.refreshing = true;
      this.refreshSubject.next(null);

      return this.auth.refreshAccessToken().pipe(
        switchMap((newAccess: string | null) => {
          this.refreshing = false;
          this.refreshSubject.next(newAccess);

          if (!newAccess) {
            // Refresh failed; ensure logout and propagate an error
            this.auth.logout();
            return throwError(() => new Error('Token refresh failed'));
          }

          const cloned = req.clone({ setHeaders: { Authorization: `Bearer ${newAccess}` }});
          return next.handle(cloned);
        }),
        catchError(err => {
          this.refreshing = false;
          this.refreshSubject.next(null);
          this.auth.logout();
          return throwError(() => err);
        })
      );
    }
  }
}