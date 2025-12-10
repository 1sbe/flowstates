import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, catchError, map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

interface TokenPair { access: string; refresh: string; }
interface UserInfo { id: number; username: string; email?: string; }

@Injectable({ providedIn: 'root' })
export class AuthService {
  private tokenKey = 'fs_access';
  private refreshKey = 'fs_refresh';

  private _auth$: BehaviorSubject<boolean>;
  public user$ = new BehaviorSubject<UserInfo | null>(null);

  constructor(private http: HttpClient) {
    this._auth$ = new BehaviorSubject<boolean>(this.hasAccessToken());
    this.loadUserFromToken();
  }

  isAuthenticated$(): Observable<boolean> {
    return this._auth$.asObservable();
  }

  private hasAccessToken(): boolean {
    try {
      return typeof window !== 'undefined' && !!localStorage.getItem(this.tokenKey);
    } catch (e) {
      return false;
    }
  }

  getAccessToken(): string | null {
    try {
      return typeof window !== 'undefined' ? localStorage.getItem(this.tokenKey) : null;
    } catch {
      return null;
    }
  }

  getRefreshToken(): string | null {
    try {
      return typeof window !== 'undefined' ? localStorage.getItem(this.refreshKey) : null;
    } catch {
      return null;
    }
  }

  getToken(): string | null {
    return this.getAccessToken();
  }

  login(username: string, password: string): Observable<TokenPair> {
    const url = `${environment.apiUrl}/api/auth/token/`;
    return this.http.post<TokenPair>(url, { username, password }).pipe(
      tap(tokens => {
        if (tokens?.access) localStorage.setItem(this.tokenKey, tokens.access);
        if (tokens?.refresh) localStorage.setItem(this.refreshKey, tokens.refresh);
        this._auth$.next(true);
        this.loadUserFromToken();
        this.fetchUserFromServer().subscribe(() => {}, () => {});
      }),
      catchError(err => {
        throw err;
      })
    );
  }

  logout() {
    try {
      localStorage.removeItem(this.tokenKey);
      localStorage.removeItem(this.refreshKey);
    } catch {}
    this._auth$.next(false);
    this.user$.next(null);
  }

  /**
   * Refresh the access token using the stored refresh token.
   * Returns Observable<string|null> where the string is the new access token (or null on failure).
   */
  refreshAccessToken(): Observable<string | null> {
    const refresh = this.getRefreshToken();
    if (!refresh) {
      this.logout();
      return of(null);
    }
    const url = `${environment.apiUrl}/api/auth/token/refresh/`;
    return this.http.post<{ access: string }>(url, { refresh }).pipe(
      // map the HTTP response to the access token (or null)
      map(res => (res && res.access) ? res.access : null),
      tap((access) => {
        if (access) {
          try { localStorage.setItem(this.tokenKey, access); } catch {}
          this._auth$.next(true);
          this.loadUserFromToken();
          this.fetchUserFromServer().subscribe(() => {}, () => {});
        }
      }),
      catchError(err => {
        this.logout();
        // return a null observable so callers receive a value consistent with signature
        return of(null);
      })
    );
  }

  private decodeJwtPayload(token: string | null): any | null {
    if (!token) return null;
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;
      const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(atob(payload).split('').map(c =>
        '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      ).join(''));
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  private loadUserFromToken() {
    const token = this.getAccessToken();
    const payload = this.decodeJwtPayload(token);
    if (payload) {
      const username = payload.username || payload.user_name || payload.sub || null;
      const userId = payload.user_id ?? payload.sub ?? null;
      if (username || userId) {
        this.user$.next({ id: userId ?? 0, username: username ?? '' });
        return;
      }
    }
    this.user$.next(null);
  }

  fetchUserFromServer(): Observable<UserInfo | null> {
    const url = `${environment.apiUrl}/api/auth/user/`;
    return this.http.get<UserInfo>(url).pipe(
      tap(u => this.user$.next(u)),
      catchError(_ => {
        this.user$.next(null);
        return of(null);
      })
    );
  }

    register(username: string, password: string, email?: string): Observable<any> {
    const url = `${environment.apiUrl}/api/auth/register/`;
    const body: any = { username, password };
    if (email) body.email = email;
    return this.http.post<any>(url, body).pipe(
      tap(res => {
      }),
      catchError(err => {
        throw err;
      })
    );
  }




}