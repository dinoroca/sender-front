import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface StatusResponse {
  active: boolean;
}

export interface TokenResponse {
  qr: string | null;
  message?: string;
}

export interface LogoutResponse {
  message: string;
  qr: string | null;
}

@Injectable({ providedIn: 'root' })
export class WhatsappService {
  private http = inject(HttpClient);

  getStatus(): Observable<StatusResponse> {
    return this.http.get<StatusResponse>('http://localhost:3000/status');
  }

  getToken(): Observable<TokenResponse> {
    return this.http.get<TokenResponse>('http://localhost:3000/token');
  }

  logout(): Observable<LogoutResponse> {
    return this.http.post<LogoutResponse>('http://localhost:3000/logout', {});
  }
}
