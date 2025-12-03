import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../environments/environment';
import { Observable } from 'rxjs';

export interface SimState {
  id?: number;
  name?: string;
  created_at?: string;
  // Put whatever state you want to store here; keep it stable between backend/frontend.
  payload: any;
}

@Injectable({ providedIn: 'root' })
export class StateService {
  private base = `${environment.apiUrl}/api/simstates/`;

  constructor(private http: HttpClient) {}

  list(): Observable<SimState[]> {
    return this.http.get<SimState[]>(this.base);
  }

  get(id: number): Observable<SimState> {
    return this.http.get<SimState>(`${this.base}${id}/`);
  }

  create(state: SimState): Observable<SimState> {
    return this.http.post<SimState>(this.base, state);
  }

  update(id: number, state: Partial<SimState>) {
    return this.http.patch<SimState>(`${this.base}${id}/`, state);
  }

  delete(id: number) {
    return this.http.delete(`${this.base}${id}/`);
  }
}