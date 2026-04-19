import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

const BACKEND_URL = environment.url_back;

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
    return this.http.get<StatusResponse>(`${BACKEND_URL}/status`);
  }

  getToken(): Observable<TokenResponse> {
    return this.http.get<TokenResponse>(`${BACKEND_URL}/token`);
  }

  logout(): Observable<LogoutResponse> {
    return this.http.post<LogoutResponse>(`${BACKEND_URL}/logout`, {});
  }
}
