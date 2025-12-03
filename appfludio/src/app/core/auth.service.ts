import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { tap, map, catchError } from 'rxjs/operators';

interface LoginResponse {
  access?: string;
  token?: string;
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private tokenKey = 'fluid_token';
  private _auth$ = new BehaviorSubject<boolean>(this.hasToken());

  constructor(private http: HttpClient) {}

  private hasToken(): boolean {
    return !!localStorage.getItem(this.tokenKey);
  }

  isAuthenticated$(): Observable<boolean> {
    return this._auth$.asObservable();
  }

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey);
  }

  // Adjust endpoint/response parsing to your backend
  login(username: string, password: string) {
    const url = `${environment.apiUrl}/auth/login/`;
    return this.http.post<LoginResponse>(url, { username, password }).pipe(
      tap(res => {
        const token = res.access ?? res.token;
        if (token) {
          localStorage.setItem(this.tokenKey, token);
          this._auth$.next(true);
        }
      })
    );
  }

  logout() {
    localStorage.removeItem(this.tokenKey);
    this._auth$.next(false);
  }
}