import { ChangeDetectionStrategy, Component, OnDestroy, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, ParamMap } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  ProcessImportHistoryItem,
  ProcessImportHistoryMeta,
} from '@app/core/models/process/process-import-history.model';
import { ProcessImportHistoryService } from '@app/core/services/process/process-import-history.service';
import { ProcessNumberPipe } from '@app/shared/pipes/process-number.pipe';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-historial-importaciones',
  standalone: true,
  imports: [CommonModule, TranslocoPipe, ProcessNumberPipe],
  templateUrl: './historial-importaciones.component.html',
  styleUrls: ['./historial-importaciones.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HistorialImportacionesComponent implements OnInit, OnDestroy {
  private _service = inject(ProcessImportHistoryService);
  private _activatedRoute = inject(ActivatedRoute);
  private _queryParamsSubscription?: { unsubscribe: () => void };
  private _highlightTimeoutId: ReturnType<typeof setTimeout> | null = null;

  public loading = signal<boolean>(false);
  public importItems = signal<ProcessImportHistoryItem[]>([]);
  public pagination = signal<ProcessImportHistoryMeta | null>(null);
  public expandedIds = signal<Set<string>>(new Set());
  public copiedMessage = signal<string | null>(null);
  public hoveredRowId = signal<string | null>(null);
  public highlightedImportId = signal<string | null>(null);
  public currentPerPage = signal<number>(15);

  public summary = computed(() => {
    const items = this.importItems();
    return items.reduce(
      (acc, item) => {
        acc.imports += 1;
        acc.total += item.total_count ?? item.actions_count ?? 0;
        acc.success += item.success_count ?? 0;
        acc.failed += item.failed_count ?? 0;
        return acc;
      },
      { imports: 0, total: 0, success: 0, failed: 0 }
    );
  });

  constructor() {
    this.loadHistory();
  }

  ngOnInit(): void {
    this._queryParamsSubscription = this._activatedRoute.queryParamMap.subscribe((params) => {
      this._focusImportFromQueryParams(params);
    });
  }

  ngOnDestroy(): void {
    this._queryParamsSubscription?.unsubscribe();
    if (this._highlightTimeoutId != null) {
      clearTimeout(this._highlightTimeoutId);
      this._highlightTimeoutId = null;
    }
  }

  loadHistory(page: number = 1, perPage: number = 15): void {
    this.currentPerPage.set(perPage);
    this.loading.set(true);

    this._service.getHistory(page, perPage).subscribe({
      next: (response) => {
        this.importItems.set(response.data || []);
        this.pagination.set({
          current_page: response.current_page,
          per_page: response.per_page,
          total: response.total,
          last_page: response.last_page,
          from: response.from,
          to: response.to,
        });
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error cargando historial de importaciones:', error);
        this.loading.set(false);
      },
    });
  }

  onPageChange(event: { page: number; perPage: number }): void {
    this.currentPerPage.set(event.perPage);
    this.loadHistory(event.page, event.perPage);
  }

  toggleExpand(itemId: string): void {
    const next = new Set(this.expandedIds());
    if (next.has(itemId)) {
      next.delete(itemId);
    } else {
      next.add(itemId);
    }
    this.expandedIds.set(next);
  }

  isExpanded(itemId: string): boolean {
    return this.expandedIds().has(itemId);
  }

  getStatusClass(status: string | null | undefined): string {
    if (status === 'completed') return 'badge-success';
    if (status === 'processing') return 'badge-warning';
    if (status === 'failed') return 'badge-error';
    return 'badge-neutral';
  }

  getDisplayName(item: ProcessImportHistoryItem): string {
    const fileName = item.file_name?.trim();
    if (fileName) return fileName;

    const date = item.date?.trim();
    const time = item.time?.trim();
    if (date && time) return `${date} ${time}`;
    if (date) return date;
    return item.id;
  }

  getPageNumbers(): number[] {
    const pagination = this.pagination();
    if (!pagination) return [];
    const current = pagination.current_page;
    const last = pagination.last_page;
    const pages: number[] = [];
    let start = Math.max(1, current - 2);
    let end = Math.min(last, current + 2);
    if (end - start < 4) {
      if (start === 1) end = Math.min(last, start + 4);
      if (start !== 1) start = Math.max(1, end - 4);
    }
    for (let i = start; i <= end; i += 1) pages.push(i);
    return pages;
  }

  copyToClipboard(text: string, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    if (!text) return;

    navigator.clipboard
      .writeText(text)
      .then(() => {
        this.copiedMessage.set('historialImportaciones.copied');
        setTimeout(() => this.copiedMessage.set(null), 2000);
      })
      .catch((error) => {
        console.error('No se pudo copiar:', error);
      });
  }

  private _focusImportFromQueryParams(params: ParamMap): void {
    const importId = params.get('import');
    if (!importId) return;

    const existing = this.importItems().some((item) => item.id === importId);
    if (existing) {
      this._highlightImportRow(importId);
      return;
    }

    this._loadPageContainingImport(importId);
  }

  private async _loadPageContainingImport(importId: string): Promise<void> {
    const perPage = this.currentPerPage();

    try {
      const firstPage = await firstValueFrom(this._service.getHistory(1, perPage));
      if (firstPage?.data?.some((item) => item.id === importId)) {
        this._applyHistoryResponse(firstPage);
        this._highlightImportRow(importId);
        return;
      }

      const lastPage = Math.max(1, firstPage?.last_page ?? 1);
      for (let page = 2; page <= lastPage; page += 1) {
        const response = await firstValueFrom(this._service.getHistory(page, perPage));
        if (response?.data?.some((item) => item.id === importId)) {
          this._applyHistoryResponse(response);
          this._highlightImportRow(importId);
          return;
        }
      }
    } catch (error) {
      console.error('Error buscando importación por id:', error);
    }
  }

  private _applyHistoryResponse(response: {
    data: ProcessImportHistoryItem[];
    current_page: number;
    per_page: number;
    total: number;
    last_page: number;
    from: number;
    to: number;
  }): void {
    this.importItems.set(response.data || []);
    this.pagination.set({
      current_page: response.current_page,
      per_page: response.per_page,
      total: response.total,
      last_page: response.last_page,
      from: response.from,
      to: response.to,
    });
    this.currentPerPage.set(response.per_page);
    this.loading.set(false);
  }

  private _highlightImportRow(importId: string): void {
    this.highlightedImportId.set(importId);
    if (this._highlightTimeoutId != null) {
      clearTimeout(this._highlightTimeoutId);
    }
    this._highlightTimeoutId = setTimeout(() => {
      this.highlightedImportId.set(null);
      this._highlightTimeoutId = null;
    }, 9000);
  }
}
