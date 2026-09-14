import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { finalize } from 'rxjs/operators';
import { ProcessService } from '@app/core/services/process/process.service';
import { ManualRegistrationRequest } from '@app/core/models/process/process.model';
import { ProcessNumberPipe } from '@app/shared/pipes/process-number.pipe';

@Component({
  selector: 'app-manual-registration-requests-modal',
  standalone: true,
  imports: [CommonModule, TranslocoPipe, ProcessNumberPipe],
  templateUrl: './manual-registration-requests-modal.component.html',
  styleUrls: ['./manual-registration-requests-modal.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ManualRegistrationRequestsModalComponent {
  private _processService = inject(ProcessService);

  readonly open = input(false);
  readonly closed = output<void>();

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly items = signal<ManualRegistrationRequest[]>([]);
  readonly count = signal(0);

  constructor() {
    effect(() => {
      if (this.open()) {
        this.load();
      }
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set(null);

    this._processService
      .getManualRegistrationRequests()
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          this.items.set(response.data ?? []);
          this.count.set(response.count ?? response.data?.length ?? 0);
        },
        error: () => {
          this.items.set([]);
          this.count.set(0);
          this.error.set('gestionProcesos.manualRegistrationRequests.error');
        },
      });
  }

  onClose(): void {
    this.closed.emit();
  }

  roleLabelKey(role: string | null | undefined): string | null {
    if (role === 'plaintiff') return 'gestionProcesos.filters.plaintiff';
    if (role === 'defendant') return 'gestionProcesos.filters.defendant';
    return null;
  }

  formatDate(value: string | null | undefined): string {
    if (!value) return '–';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleString('es-CO', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
