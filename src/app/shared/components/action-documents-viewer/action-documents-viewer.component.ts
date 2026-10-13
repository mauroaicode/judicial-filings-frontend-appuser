import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  input,
  output,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActionDocument } from '@app/core/models/process/process.model';
import { ProcessService } from '@app/core/services/process/process.service';

type ViewerMode = 'list' | 'viewer';

@Component({
  selector: 'app-action-documents-viewer',
  standalone: true,
  imports: [CommonModule, TranslocoPipe],
  templateUrl: './action-documents-viewer.component.html',
  styleUrls: ['./action-documents-viewer.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionDocumentsViewerComponent {
  private _processService = inject(ProcessService);
  private _transloco = inject(TranslocoService);
  private _destroyRef = inject(DestroyRef);
  private _sanitizer = inject(DomSanitizer);

  public open = input(false);
  public documents = input<ActionDocument[]>([]);
  public actionLabel = input<string | null>(null);
  /** When true and there is exactly one document, open the viewer immediately */
  public autoOpenFirst = input(false);

  public closed = output<void>();
  public error = output<string>();

  public mode = signal<ViewerMode>('list');
  public loadingMediaId = signal<number | null>(null);
  public viewerSafeUrl = signal<SafeResourceUrl | null>(null);
  public viewerFilename = signal<string>('');
  public viewerMediaId = signal<number | null>(null);

  private _objectUrl: string | null = null;
  private _autoOpenedForOpenCycle = false;

  constructor() {
    effect(() => {
      if (!this.open()) {
        this.resetViewerState();
        this.mode.set('list');
        this._autoOpenedForOpenCycle = false;
        return;
      }

      if (
        this.autoOpenFirst() &&
        !this._autoOpenedForOpenCycle &&
        this.documents().length === 1 &&
        this.mode() === 'list' &&
        this.loadingMediaId() == null
      ) {
        this._autoOpenedForOpenCycle = true;
        this.openDocument(this.documents()[0]);
      }
    });

    this._destroyRef.onDestroy(() => this.revokeViewerUrl());
  }

  public onBackdropClose(): void {
    this.closed.emit();
  }

  public onCloseClick(): void {
    this.closed.emit();
  }

  public openDocument(doc: ActionDocument): void {
    if (this.loadingMediaId() != null) return;

    this.loadingMediaId.set(doc.id);
    this._processService
      .downloadMedia(doc.id)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (blob) => {
          this.loadingMediaId.set(null);
          if (!this.open()) return;
          const pdfBlob =
            blob.type === 'application/pdf'
              ? blob
              : new Blob([blob], { type: 'application/pdf' });
          this.revokeViewerUrl();
          this._objectUrl = URL.createObjectURL(pdfBlob);
          this.viewerSafeUrl.set(
            this._sanitizer.bypassSecurityTrustResourceUrl(this._objectUrl)
          );
          this.viewerFilename.set(doc.original_filename?.trim() || 'documento.pdf');
          this.viewerMediaId.set(doc.id);
          this.mode.set('viewer');
        },
        error: (err: { status?: number }) => {
          this.loadingMediaId.set(null);
          if (!this.open()) return;
          const status = err?.status;
          if (status === 404) {
            this.error.emit(
              this._transloco.translate('processDetail.actions.documents.notFound')
            );
            return;
          }
          if (status === 422) {
            this.error.emit(
              this._transloco.translate('processDetail.actions.documents.noOrganization')
            );
            return;
          }
          this.error.emit(
            this._transloco.translate('processDetail.actions.documents.downloadError')
          );
        },
      });
  }

  public backToList(): void {
    this.revokeViewerUrl();
    this.viewerSafeUrl.set(null);
    this.viewerFilename.set('');
    this.viewerMediaId.set(null);
    this.mode.set('list');
  }

  public downloadCurrent(): void {
    const url = this._objectUrl;
    const filename = this.viewerFilename() || 'documento.pdf';
    if (!url) return;

    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.rel = 'noopener';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }

  public formatSize(bytes: number | null | undefined): string {
    if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private resetViewerState(): void {
    this.revokeViewerUrl();
    this.viewerSafeUrl.set(null);
    this.viewerFilename.set('');
    this.viewerMediaId.set(null);
    this.loadingMediaId.set(null);
  }

  private revokeViewerUrl(): void {
    if (this._objectUrl) {
      URL.revokeObjectURL(this._objectUrl);
      this._objectUrl = null;
    }
  }
}
