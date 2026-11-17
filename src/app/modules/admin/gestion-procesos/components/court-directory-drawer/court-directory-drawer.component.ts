import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  HostBinding,
  HostListener,
  effect,
  inject,
  input,
  output,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { CourtDirectoryEntry } from '@app/core/models/court-directory/court-directory.model';
import { FilingNumberParts } from '@app/core/utils/filing-number.util';

@Component({
  selector: 'app-court-directory-drawer',
  standalone: true,
  imports: [CommonModule, TranslocoPipe],
  templateUrl: './court-directory-drawer.component.html',
  styleUrls: ['./court-directory-drawer.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourtDirectoryDrawerComponent {
  readonly isOpen = input(false);
  readonly courtName = input<string | null>(null);
  readonly processNumber = input<string | null>(null);
  readonly filing = input<FilingNumberParts | null>(null);
  readonly entries = input<CourtDirectoryEntry[]>([]);
  readonly loading = input(false);
  readonly error = input(false);
  readonly invalid = input(false);

  readonly closed = output<void>();
  readonly copyEmail = output<string>();
  readonly copyCode = output<string>();

  @HostBinding('class.court-directory-drawer-open')
  get isDrawerOpen(): boolean {
    return this.isOpen();
  }

  constructor() {
    const destroyRef = inject(DestroyRef);
    effect(() => {
      document.body.classList.toggle('court-directory-drawer-body-open', this.isOpen());
    });
    destroyRef.onDestroy(() => {
      document.body.classList.remove('court-directory-drawer-body-open');
    });
  }

  close(): void {
    this.closed.emit();
  }

  onToggleChange(event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    if (!checked) {
      this.closed.emit();
    }
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.isOpen()) {
      this.closed.emit();
    }
  }
}
