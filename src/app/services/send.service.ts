import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

export interface SendPayload {
  withImage: boolean;
  text?: string;
  phoneNumbers: string[];
  imageId?: string;
}

export interface SendResult {
  phone: string;
  status: 'sent' | 'error';
  message?: string;
}

export interface SendResponse {
  sent: number;
  errors: number;
  results: SendResult[];
}

@Injectable({ providedIn: 'root' })
export class SendService {
  private http = inject(HttpClient);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  sendMessages(payload: SendPayload): Observable<SendResponse> {
    this.loading.set(true);
    this.error.set(null);

    return this.http
      .post<SendResponse>('http://localhost:3000/send', payload)
      .pipe(
        tap({
          next: () => this.loading.set(false),
          error: (err: HttpErrorResponse) => {
            this.loading.set(false);
            this.error.set(
              err.error?.message ?? err.message ?? 'Error al enviar mensajes'
            );
          },
        })
      );
  }
}
