import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, throwError, of } from 'rxjs';
import { tap, catchError, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

interface TokenPair { access: string; refresh: string; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private tokenKey = 'fs_access';
  private refreshKey = 'fs_refresh';
  private _auth$ = new BehaviorSubject<boolean>(this.hasAccessToken());

  constructor(private http: HttpClient) {}

  isAuthenticated$() {
    return this._auth$.asObservable();
  }

  private hasAccessToken(): boolean {
    return !!localStorage.getItem(this.tokenKey);
  }

  // current API used by new code
  getAccessToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.refreshKey);
  }

  // BACKWARDS-COMPATIBILITY: some older components call getToken()
  // Keep this wrapper so you don't have to change existing callers.
  getToken(): string | null {
    return this.getAccessToken();
  }

  login(username: string, password: string): Observable<TokenPair> {
    const url = `${environment.apiUrl}/api/auth/token/`;
    return this.http.post<TokenPair>(url, { username, password }).pipe(
      tap(tokens => {
        if (tokens?.access) {
          localStorage.setItem(this.tokenKey, tokens.access);
        }
        if (tokens?.refresh) {
          localStorage.setItem(this.refreshKey, tokens.refresh);
        }
        this._auth$.next(true);
      }),
      catchError(err => {
        // bubble error up
        return throwError(() => err);
      })
    );
  }

  logout() {
    localStorage.removeItem(this.tokenKey);
    localStorage.removeItem(this.refreshKey);
    this._auth$.next(false);
  }

  refreshAccessToken(): Observable<string> {
    const refresh = this.getRefreshToken();
    if (!refresh) {
      this.logout();
      return throwError(() => new Error('No refresh token'));
    }
    const url = `${environment.apiUrl}/api/auth/token/refresh/`;
    return this.http.post<{ access: string }>(url, { refresh }).pipe(
      tap(res => {
        if (res && res.access) {
          localStorage.setItem(this.tokenKey, res.access);
          this._auth$.next(true);
        }
      }),
      switchMap(res => of(res.access)),
      catchError(err => {
        this.logout();
        return throwError(() => err);
      })
    );
  }
}