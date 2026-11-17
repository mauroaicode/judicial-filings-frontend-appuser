import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { EMPTY, merge, Subject } from 'rxjs';
import { catchError, debounceTime, distinctUntilChanged, finalize, map, switchMap, tap } from 'rxjs/operators';
import {
  CourtDirectoryEntry,
  CourtDirectoryPage,
} from '@app/core/models/court-directory/court-directory.model';
import { CourtDirectoryService } from '@app/core/services/court-directory/court-directory.service';

type SearchTrigger = 'reset' | 'page';

@Component({
  selector: 'app-directorio-despachos',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, TranslocoPipe],
  templateUrl: './directorio-despachos.component.html',
  styleUrls: ['./directorio-despachos.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DirectorioDespachosComponent {
  private readonly _directory = inject(CourtDirectoryService);
  private readonly _destroyRef = inject(DestroyRef);
  private readonly _transloco = inject(TranslocoService);
  private readonly _refresh$ = new Subject<SearchTrigger>();

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly departmentControl = new FormControl('', { nonNullable: true });
  readonly cityControl = new FormControl('', { nonNullable: true });
  readonly specialtyControl = new FormControl('', { nonNullable: true });

  readonly filtersOpen = signal(false);
  readonly loading = signal(false);
  readonly error = signal(false);
  readonly hasSearched = signal(false);
  readonly entries = signal<CourtDirectoryEntry[]>([]);
  readonly pageInfo = signal<CourtDirectoryPage | null>(null);
  readonly copiedMessage = signal<string | null>(null);

  private page = 1;
  private copiedTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const reset$ = merge(
      this.searchControl.valueChanges,
      this.departmentControl.valueChanges,
      this.cityControl.valueChanges,
      this.specialtyControl.valueChanges,
    ).pipe(
      debounceTime(300),
      map(() => this.queryKey()),
      distinctUntilChanged(),
      map((): SearchTrigger => 'reset'),
    );

    merge(reset$, this._refresh$)
      .pipe(
        tap((trigger) => {
          if (trigger === 'reset') {
            this.page = 1;
          }
        }),
        switchMap(() => this.fetch()),
        takeUntilDestroyed(this._destroyRef),
      )
      .subscribe();
  }

  toggleFilters(): void {
    this.filtersOpen.update((open) => !open);
  }

  clearFilters(): void {
    this.departmentControl.setValue('');
    this.cityControl.setValue('');
    this.specialtyControl.setValue('');
  }

  previousPage(): void {
    const info = this.pageInfo();
    if (!info || info.current_page <= 1 || this.loading()) {
      return;
    }
    this.page = info.current_page - 1;
    this._refresh$.next('page');
  }

  nextPage(): void {
    const info = this.pageInfo();
    if (!info || info.current_page >= info.last_page || this.loading()) {
      return;
    }
    this.page = info.current_page + 1;
    this._refresh$.next('page');
  }

  copyEmail(email: string, event: MouseEvent): void {
    event.stopPropagation();
    this.copy(email, this._transloco.translate('courtDirectory.emailCopied'));
  }

  copyCode(code: string, event: MouseEvent): void {
    event.stopPropagation();
    this.copy(code, this._transloco.translate('courtDirectory.codeCopied'));
  }

  private queryKey(): string {
    return [
      this.searchControl.value.trim(),
      this.departmentControl.value.trim(),
      this.cityControl.value.trim(),
      this.specialtyControl.value.trim(),
    ].join('\u0000');
  }

  private fetch() {
    const q = this.searchControl.value.trim();
    const department = this.departmentControl.value.trim();
    const city = this.cityControl.value.trim();
    const specialty = this.specialtyControl.value.trim();

    const hasFilter = Boolean(department || city || specialty);
    if (q.length < 2 && !hasFilter) {
      this.hasSearched.set(false);
      this.loading.set(false);
      this.error.set(false);
      this.entries.set([]);
      this.pageInfo.set(null);
      return EMPTY;
    }

    this.hasSearched.set(true);
    this.loading.set(true);
    this.error.set(false);

    return this._directory.search({
      q: q.length >= 2 ? q : '',
      department,
      city,
      specialty,
      page: this.page,
    }).pipe(
      tap((page) => {
        this.entries.set(page.data);
        this.pageInfo.set(page);
      }),
      catchError((error: unknown) => {
        this.entries.set([]);
        this.pageInfo.set(null);
        const status = error instanceof HttpErrorResponse ? error.status : 0;
        this.error.set(status === 0 || status >= 500);
        return EMPTY;
      }),
      finalize(() => this.loading.set(false)),
    );
  }

  private copy(value: string, message: string): void {
    const text = value.trim();
    if (!text) {
      return;
    }

    navigator.clipboard.writeText(text).then(() => {
      this.copiedMessage.set(message);
      if (this.copiedTimer) {
        clearTimeout(this.copiedTimer);
      }
      this.copiedTimer = setTimeout(() => this.copiedMessage.set(null), 2500);
    });
  }
}
