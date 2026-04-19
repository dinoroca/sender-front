import { Component, computed, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { UploadService } from './services/upload.service';
import { SendService, SendResponse, SendPayload } from './services/send.service';
import { WhatsappService, LogoutResponse } from './services/whatsapp.service';
import { QrCodeComponent } from 'ng-qrcode';

type AppView = 'loading' | 'qr' | 'send';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [QrCodeComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.css',
})
export class AppComponent implements OnInit, OnDestroy {
  private uploadService = inject(UploadService);
  private sendService = inject(SendService);
  private whatsappService = inject(WhatsappService);

  // ── Session state ────────────────────────────────────────────────────────────
  view = signal<AppView>('loading');
  qrCode = signal<string | null>(null);
  logoutLoading = signal(false);
  logoutError = signal<string | null>(null);

  private statusPollId: ReturnType<typeof setInterval> | null = null;
  private retryTimeoutId: ReturnType<typeof setTimeout> | null = null;

  // ── Form state ──────────────────────────────────────────────────────────────
  withImage = signal(false);
  imageFile = signal<File | null>(null);
  imagePreview = signal<string | null>(null);
  imageId = signal<string | null>(null);
  isDragging = signal(false);

  messageText = signal('');
  phoneInput = signal('');

  result = signal<SendResponse | null>(null);
  formError = signal<string | null>(null);

  // ── Service state (exposed as signals) ─────────────────────────────────────
  uploadLoading = this.uploadService.loading;
  uploadError = this.uploadService.error;
  sendLoading = this.sendService.loading;
  sendError = this.sendService.error;

  // ── Derived signals ─────────────────────────────────────────────────────────
  phoneNumbers = computed(() =>
    this.phoneInput()
      .split(/[\s,;\n]+/)
      .map((p) => p.trim().replace(/\D/g, ''))
      .filter((p) => p.length > 0)
  );

  validPhoneNumbers = computed(() =>
    this.phoneNumbers().filter((p) => /^\d{9}$/.test(p))
  );

  invalidPhoneNumbers = computed(() =>
    this.phoneNumbers().filter((p) => !/^\d{9}$/.test(p))
  );

  canSend = computed(() => {
    if (this.sendLoading() || this.uploadLoading()) return false;
    if (this.validPhoneNumbers().length === 0) return false;
    if (this.withImage() && !this.imageId()) return false;
    if (!this.withImage() && !this.messageText().trim()) return false;
    return true;
  });

  // ── Lifecycle ────────────────────────────────────────────────────────────────
  ngOnInit(): void {
    this.checkStatus();
  }

  ngOnDestroy(): void {
    this.stopStatusPolling();
    if (this.retryTimeoutId !== null) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  // ── Logout ──────────────────────────────────────────────────────────────────
  logout(): void {
    this.stopStatusPolling();
    if (this.retryTimeoutId !== null) {
      clearTimeout(this.retryTimeoutId);
      this.retryTimeoutId = null;
    }
    this.logoutLoading.set(true);
    this.logoutError.set(null);
    this.qrCode.set(null);
    this.view.set('loading');

    this.whatsappService.logout().subscribe({
      next: (res: LogoutResponse) => {
        this.logoutLoading.set(false);
        if (res.qr) {
          this.qrCode.set(res.qr);
          this.view.set('qr');
          this.startStatusPolling();
        } else {
          // QR aún no listo — pollear /token hasta obtenerlo
          this.fetchToken();
        }
      },
      error: (err: HttpErrorResponse) => {
        this.logoutLoading.set(false);
        this.logoutError.set(
          err.error?.error ?? err.message ?? 'Error al cerrar sesión'
        );
        this.view.set('send');
      },
    });
  }

  // ── Session flow ─────────────────────────────────────────────────────────────
  private checkStatus(): void {
    this.whatsappService.getStatus().subscribe({
      next: (res) => {
        if (res.active) {
          this.stopStatusPolling();
          this.view.set('send');
        } else {
          this.fetchToken();
        }
      },
      error: () => {
        this.retryTimeoutId = setTimeout(() => this.checkStatus(), 3000);
      },
    });
  }

  private fetchToken(): void {
    this.whatsappService.getToken().subscribe({
      next: (res) => {
        if (res.qr) {
          this.qrCode.set(res.qr);
          this.view.set('qr');
          this.startStatusPolling();
        } else {
          // qr: null con mensaje de sesión ya activa
          this.view.set('send');
        }
      },
      error: () => {
        // 404 u otro error: QR aún no generado, reintentar en 3s
        this.retryTimeoutId = setTimeout(() => this.fetchToken(), 3000);
      },
    });
  }

  private startStatusPolling(): void {
    if (this.statusPollId !== null) return;

    const checkAndAdvance = () => {
      this.whatsappService.getStatus().subscribe({
        next: (res) => {
          if (res.active) {
            this.stopStatusPolling();
            this.view.set('send');
          }
        },
      });
    };

    // Comprobación inmediata para no esperar el primer tick
    checkAndAdvance();
    this.statusPollId = setInterval(checkAndAdvance, 3000);
  }

  private stopStatusPolling(): void {
    if (this.statusPollId !== null) {
      clearInterval(this.statusPollId);
      this.statusPollId = null;
    }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────────
  isValidPhone(phone: string): boolean {
    return /^\d{9}$/.test(phone);
  }

  removePhoneAt(index: number): void {
    const nums = [...this.phoneNumbers()];
    nums.splice(index, 1);
    this.phoneInput.set(nums.join(' '));
  }

  // ── Image handlers ──────────────────────────────────────────────────────────
  toggleWithImage(): void {
    this.withImage.update((v) => !v);
    if (!this.withImage()) {
      this.clearImage();
    }
  }

  private clearImage(): void {
    this.imageFile.set(null);
    this.imagePreview.set(null);
    this.imageId.set(null);
    this.uploadService.error.set(null);
  }

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(true);
  }

  onDragLeave(): void {
    this.isDragging.set(false);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.isDragging.set(false);
    const file = event.dataTransfer?.files[0];
    if (file && file.type.startsWith('image/')) {
      this.processImageFile(file);
    }
  }

  onFileSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) this.processImageFile(file);
  }

  private processImageFile(file: File): void {
    this.imageFile.set(file);
    this.imageId.set(null);

    const reader = new FileReader();
    reader.onload = (e) => this.imagePreview.set(e.target?.result as string);
    reader.readAsDataURL(file);

    this.uploadService.uploadImage(file).subscribe({
      next: (res) => this.imageId.set(res.imageId),
      error: (_err: HttpErrorResponse) => this.imageId.set(null),
    });
  }

  // ── Send ────────────────────────────────────────────────────────────────────
  send(): void {
    this.formError.set(null);
    this.result.set(null);

    if (this.invalidPhoneNumbers().length > 0) {
      this.formError.set(
        `Números inválidos (deben tener exactamente 9 dígitos): ${this.invalidPhoneNumbers().join(', ')}`
      );
      return;
    }

    const payload: SendPayload = {
      withImage: this.withImage(),
      phoneNumbers: this.validPhoneNumbers(),
    };

    if (this.messageText().trim()) {
      payload.text = this.messageText().trim();
    }

    if (this.withImage() && this.imageId()) {
      payload.imageId = this.imageId()!;
    }

    this.sendService.sendMessages(payload).subscribe({
      next: (res) => this.result.set(res),
      error: (_err: HttpErrorResponse) => {},
    });
  }
}

