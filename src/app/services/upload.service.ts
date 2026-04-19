import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';

const BACKEND_URL = environment.url_back;

@Injectable({ providedIn: 'root' })
export class UploadService {
  private http = inject(HttpClient);

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  uploadImage(file: File): Observable<{ imageId: string }> {
    const formData = new FormData();
    formData.append('image', file);

    this.loading.set(true);
    this.error.set(null);

    return this.http
      .post<{ imageId: string }>(`${BACKEND_URL}/upload`, formData)
      .pipe(
        tap({
          next: () => this.loading.set(false),
          error: (err: HttpErrorResponse) => {
            this.loading.set(false);
            this.error.set(
              err.error?.message ?? err.message ?? 'Error al subir imagen'
            );
          },
        })
      );
  }
}
