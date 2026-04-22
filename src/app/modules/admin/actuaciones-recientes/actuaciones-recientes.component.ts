import { 
  ChangeDetectionStrategy, 
  Component, 
  ElementRef, 
  inject, 
  OnInit, 
  signal, 
  ViewChild, 
  ViewEncapsulation,
  OnDestroy
} from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { TranslocoModule } from '@jsverse/transloco';
import { ReactiveFormsModule, FormBuilder, FormGroup } from '@angular/forms';
import { NotificationDigestHistoryService } from '@app/core/services/notification/notification-digest-history.service';
import {
  NotificationDigestHistory,
  NotificationDigestHistoryFilter,
  NotificationDigestDetailItem,
  NotificationDigestDisplayRow,
} from '@app/core/models/notification/notification-digest-history.model';
import { finalize } from 'rxjs';
import { DateRangePickerComponent, DateRange } from '@app/shared/components/date-range-picker/date-range-picker.component';
import { ProcessNumberPipe } from '@app/shared/pipes/process-number.pipe';
import { ProcessAlertTooltipComponent } from '@app/shared/components/process-alert-tooltip/process-alert-tooltip.component';

@Component({
  selector: 'app-actuaciones-recientes',
  standalone: true,
  imports: [CommonModule, TranslocoModule, ReactiveFormsModule, DateRangePickerComponent, ProcessNumberPipe, ProcessAlertTooltipComponent],
  templateUrl: './actuaciones-recientes.component.html',
  styleUrls: ['./actuaciones-recientes.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActuacionesRecientesComponent implements OnInit, OnDestroy {
  private _historyService = inject(NotificationDigestHistoryService);
  private _fb = inject(FormBuilder);
  private _router = inject(Router);
  private _activatedRoute = inject(ActivatedRoute);

  /** Misma rejilla que gestión de procesos */
  public readonly digestPageSizeOptions = [10, 20, 25, 50, 100] as const;
  private readonly defaultDigestPerPage = 20;
  
  // Signals for state management
  public historyItems = signal<NotificationDigestHistory[]>([]);
  public loading = signal<boolean>(false);
  public currentPage = signal<number>(1);
  public totalItems = signal<number>(0);
  public hasMorePages = signal<boolean>(true);
  
  // Filters state
  public showFilters = signal<boolean>(false);
  public filterForm!: FormGroup;
  private _currentFilters: NotificationDigestHistoryFilter = {};

  // Modal State
  public isModalOpen = signal<boolean>(false);
  public isLoadingDetails = signal<boolean>(false);
  public selectedDigest = signal<NotificationDigestHistory | null>(null);
  public selectedDigestDetails = signal<NotificationDigestDisplayRow[]>([]);
  public showLegendModal = signal<boolean>(false);
  public showActionDetailModal = signal<boolean>(false);
  public selectedActionDetail = signal<NotificationDigestDisplayRow | null>(null);
  public copiedMessage = signal<string | null>(null);

  @ViewChild('loadingTrigger') loadingTrigger!: ElementRef;
  private _observer!: IntersectionObserver;

  ngOnInit(): void {
    this.initForm();
    this.loadHistory();
    this.setupInfiniteScroll();
    queueMicrotask(() => this.tryOpenDigestFromQueryParams());
  }

  private initForm(): void {
    this.filterForm = this._fb.group({
      created_at_range: [null as DateRange | null],
      process_number: ['']
    });
  }

  public toggleFilters(): void {
    this.showFilters.set(!this.showFilters());
  }

  public applyFilters(): void {
    // Collect non-empty values
    const rawForm = this.filterForm.value;
    const filters: NotificationDigestHistoryFilter = {};
    
    if (rawForm.created_at_range) {
      if (rawForm.created_at_range.from) filters.created_at_from = rawForm.created_at_range.from;
      if (rawForm.created_at_range.to) filters.created_at_to = rawForm.created_at_range.to;
    }
    
    if (rawForm.process_number) filters.process_number = rawForm.process_number.trim();
    
    this._currentFilters = filters;
    this.resetAndReload();
  }

  public clearFilters(): void {
    this.filterForm.reset();
    this._currentFilters = {};
    this.resetAndReload();
  }

  private resetAndReload(): void {
    this.historyItems.set([]);
    this.currentPage.set(1);
    this.hasMorePages.set(true);
    this.totalItems.set(0);
    this.loadHistory();
  }

  ngOnDestroy(): void {
    if (this._observer) {
      this._observer.disconnect();
    }
  }

  /**
   * Load history items from service
   */
  public loadHistory(): void {
    if (this.loading() || !this.hasMorePages()) return;

    this.loading.set(true);
    
    this._historyService.getHistory(this.currentPage(), 20, this._currentFilters)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (response) => {
          const currentItems = this.historyItems();
          this.historyItems.set([...currentItems, ...response.data]);
          this.totalItems.set(response.total);
          this.hasMorePages.set(response.next_page_url !== null);
          
          if (this.hasMorePages()) {
            this.currentPage.update(page => page + 1);
          }
        },
        error: (error) => {
          console.error('Error loading notification history:', error);
        }
      });
  }

  /**
   * Setup intersection observer for infinite scroll
   */
  private setupInfiniteScroll(): void {
    this._observer = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting && !this.loading() && this.hasMorePages()) {
        this.loadHistory();
      }
    }, {
      threshold: 0.1
    });

    // Wait for view init to observe the trigger
    setTimeout(() => {
      if (this.loadingTrigger) {
        this._observer.observe(this.loadingTrigger.nativeElement);
      }
    }, 500);
  }

  /**
   * Get CSS class based on period name
   */
  public getPeriodClass(period: string): string {
    switch (period.toLowerCase()) {
      case 'mañana': return 'morning';
      case 'tarde': return 'afternoon';
      case 'noche': return 'night';
      default: return 'morning';
    }
  }

  // --- Modal Logic (detalle consolidado + paginación / query params) ---

  public digestDetailPagination = signal<{
    current_page: number;
    last_page: number;
    total: number;
    from: number;
    to: number;
    per_page: number;
  } | null>(null);

  /**
   * Abre el modal desde una tarjeta del historial y sincroniza `?digest=&page=&per_page=`.
   */
  public openDigestModal(
    item: NotificationDigestHistory,
    page: number = 1,
    perPage?: number
  ): void {
    const pp = this.normalizeDigestPerPage(
      perPage ?? this.digestDetailPagination()?.per_page ?? this.defaultDigestPerPage
    );
    this.selectedDigest.set(item);
    this.isModalOpen.set(true);
    this.isLoadingDetails.set(true);
    this.syncDigestQueryParams(item.id, page, pp);
    this.fetchDigestDetails(item.id, page, pp);
  }

  /**
   * Cambio de página o tamaño de página (mismo contrato que gestión: { page, perPage }).
   */
  public onDigestDetailPageChange(event: { page: number; perPage: number }): void {
    const digest = this.selectedDigest();
    if (!digest) return;
    const pp = this.normalizeDigestPerPage(event.perPage);
    this.isLoadingDetails.set(true);
    this.syncDigestQueryParams(digest.id, event.page, pp);
    this.fetchDigestDetails(digest.id, event.page, pp);
  }

  public getDigestPageNumbers(): number[] {
    const pagination = this.digestDetailPagination();
    if (!pagination) return [];
    const current = pagination.current_page;
    const last = pagination.last_page;
    const pages: number[] = [];
    let start = Math.max(1, current - 2);
    let end = Math.min(last, current + 2);
    if (end - start < 4) {
      if (start === 1) end = Math.min(last, start + 4);
      else start = Math.max(1, end - 4);
    }
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }

  /** Índice global de fila (respeta paginación del API). */
  public digestRowIndex(rowIndex: number): number {
    const p = this.digestDetailPagination();
    if (!p) return rowIndex + 1;
    if (p.from != null && p.from > 0) {
      return p.from + rowIndex;
    }
    return (p.current_page - 1) * p.per_page + rowIndex + 1;
  }

  public closeDigestModal(): void {
    this.clearDigestQueryParams();
    this.isModalOpen.set(false);
    this.showActionDetailModal.set(false);
    this.selectedActionDetail.set(null);
    this.digestDetailPagination.set(null);
    setTimeout(() => {
      this.selectedDigest.set(null);
      this.selectedDigestDetails.set([]);
    }, 300);
  }

  private tryOpenDigestFromQueryParams(): void {
    const q = this._activatedRoute.snapshot.queryParamMap;
    const digestId = q.get('digest');
    if (!digestId) return;

    const page = Math.max(1, parseInt(q.get('page') || '1', 10) || 1);
    const perRaw = parseInt(q.get('per_page') || String(this.defaultDigestPerPage), 10);
    const perPage = this.normalizeDigestPerPage(
      Number.isFinite(perRaw) ? perRaw : this.defaultDigestPerPage
    );

    const stub: NotificationDigestHistory = {
      id: digestId,
      date: '',
      time: '',
      period: '',
      actions_count: 0,
      is_notified: false,
      email_notified_at: null,
      whatsapp_notified_at: null,
      sms_notified_at: null,
    };

    this.selectedDigest.set(stub);
    this.isModalOpen.set(true);
    this.isLoadingDetails.set(true);
    this.fetchDigestDetails(digestId, page, perPage);
  }

  private normalizeDigestPerPage(n: number): number {
    return (this.digestPageSizeOptions as readonly number[]).includes(n)
      ? n
      : this.defaultDigestPerPage;
  }

  private syncDigestQueryParams(digestId: string, page: number, perPage: number): void {
    this._router.navigate([], {
      relativeTo: this._activatedRoute,
      queryParams: {
        digest: digestId,
        page: page > 1 ? String(page) : null,
        per_page: perPage !== this.defaultDigestPerPage ? String(perPage) : null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private clearDigestQueryParams(): void {
    this._router.navigate([], {
      relativeTo: this._activatedRoute,
      queryParams: {
        digest: null,
        page: null,
        per_page: null,
      },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
  }

  private fetchDigestDetails(digestId: string, page: number, perPage: number): void {
    this.digestDetailPagination.set(null);
    this._historyService
      .getDigestDetails(digestId, page, perPage)
      .pipe(finalize(() => this.isLoadingDetails.set(false)))
      .subscribe({
        next: (response: any) => {
          this.digestDetailPagination.set({
            current_page: response?.current_page ?? 1,
            last_page: response?.last_page ?? 1,
            total: response?.total ?? 0,
            from: response?.from ?? 0,
            to: response?.to ?? 0,
            per_page: response?.per_page ?? perPage,
          });
          this.updateSelectedDigestFromDetailResponse(response, digestId);
          const raw = this.normalizeDigestDetailPayload(response);
          this.selectedDigestDetails.set(this.mergeDigestDetailRows(raw));
        },
        error: (error) => {
          console.error('Error loading digest details:', error);
          this.selectedDigestDetails.set([]);
          this.digestDetailPagination.set(null);
        },
      });
  }

  public copyToClipboard(text: string, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!text) return;
    
    navigator.clipboard.writeText(text).then(() => {
      this.copiedMessage.set('Copiado al portapapeles');
      setTimeout(() => {
        this.copiedMessage.set(null);
      }, 2000);
    }).catch(err => {
      console.error('Could not copy text: ', err);
    });
  }

  public goToProcessDetail(processId: string | null | undefined, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    if (!processId) return;
    const urlTree = this._router.createUrlTree(['/gestion-procesos', processId]);
    const url = this._router.serializeUrl(urlTree);
    window.open(url, '_blank', 'noopener,noreferrer');
  }

  public openLegendModal(event?: MouseEvent): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.showLegendModal.set(true);
  }

  public closeLegendModal(): void {
    this.showLegendModal.set(false);
  }

  public openActionDetailModal(action: NotificationDigestDisplayRow, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.selectedActionDetail.set(action);
    this.showActionDetailModal.set(true);
  }

  public closeActionDetailModal(): void {
    this.showActionDetailModal.set(false);
    this.selectedActionDetail.set(null);
  }

  public getPartyDisplay(parties: string[]): { mainText: string, extraCount: number, fullList: string[] } {
    if (!parties || parties.length === 0) return { mainText: '', extraCount: 0, fullList: [] };
    return {
      mainText: parties[0],
      extraCount: parties.length - 1,
      fullList: parties
    };
  }

  /**
   * Etiqueta del badge morado (misma lógica que detalle de proceso / actuaciones).
   */
  public getFijacionBadgeLabel(actionText: string | undefined): string {
    const t = (actionText ?? '').toLowerCase();
    if (t.includes('notificacion') || t.includes('notificación')) {
      return 'Notificación';
    }
    return 'Fijación';
  }

  public digestActionLineText(item: NotificationDigestDetailItem): string {
    const t = item.action_text?.trim() || item.action?.trim();
    return t || '–';
  }

  /** Texto del auto empaquetado en la misma fila (API is_merged). */
  public digestLinkedActionText(item: NotificationDigestDetailItem): string {
    const t = item.linked_action_text?.trim();
    return t || '–';
  }

  /** Anotación asociada al auto (omite placeholders vacíos). */
  public shouldShowLinkedAnnotation(item: NotificationDigestDetailItem): boolean {
    const a = item.linked_annotation?.trim();
    if (!a) return false;
    return a !== '—' && a !== '---' && a !== '–';
  }

  public formatLinkedAnnotation(item: NotificationDigestDetailItem): string {
    return (item.linked_annotation ?? '').replace(/\r\n/g, ' ').replace(/\s+/g, ' ').trim();
  }

  public shouldShowMainAnnotation(item: NotificationDigestDetailItem): boolean {
    const a = item.annotation?.trim();
    if (!a) return false;
    return a !== '—' && a !== '---' && a !== '–';
  }

  public formatMainAnnotation(item: NotificationDigestDetailItem): string {
    return (item.annotation ?? '').replace(/\r\n/g, ' ').replace(/\s+/g, ' ').trim();
  }

  public digestRowTrack(row: NotificationDigestDisplayRow, index: number): string {
    const main = row.process_action_id ?? `idx_${index}`;
    const rel = row.related_action?.process_action_id ?? '';
    return `${main}_${rel}`;
  }

  /**
   * Une en una sola fila fijación/notificación + auto vía notified_action_id / fijacion_action_id
   * (misma idea que process-detail loadActions).
   */
  private mergeDigestDetailRows(raw: NotificationDigestDetailItem[]): NotificationDigestDisplayRow[] {
    if (!raw?.length) return [];

    const rows: NotificationDigestDisplayRow[] = raw.map((r) => ({
      ...r,
      related_action: undefined,
    }));
    // Regla actual:
    // - Si backend manda is_merged=true, ya viene fusionado y se pinta en una fila.
    // - Si backend manda fijación y auto por separado (sin is_merged), NO agrupar en cliente.
    //   Esto preserva el per_page real del endpoint (ej: 20 actuaciones => 20 filas renderizadas).
    return rows;
  }

  private normalizeDigestDetailPayload(response: any): NotificationDigestDetailItem[] {
    if (response?.data && Array.isArray(response.data)) {
      if (response.data.length > 0 && response.data[0]?.data) {
        return response.data[0].data as NotificationDigestDetailItem[];
      }
      return response.data as NotificationDigestDetailItem[];
    }
    if (response?.data?.data && Array.isArray(response.data.data)) {
      return response.data.data as NotificationDigestDetailItem[];
    }
    return [];
  }

  private updateSelectedDigestFromDetailResponse(response: any, digestId: string): void {
    const current = this.selectedDigest();
    const source = Array.isArray(response?.data) && response.data.length > 0 && response.data[0]
      ? response.data[0]
      : response;

    if (!source) return;

    this.selectedDigest.set({
      id: current?.id ?? source.id ?? digestId,
      date: source.date ?? current?.date ?? '',
      time: source.time ?? current?.time ?? '',
      period: source.period ?? current?.period ?? '',
      actions_count: source.actions_count ?? current?.actions_count ?? 0,
      is_notified: source.is_notified ?? current?.is_notified ?? false,
      email_notified_at: source.email_notified_at ?? current?.email_notified_at ?? null,
      whatsapp_notified_at: source.whatsapp_notified_at ?? current?.whatsapp_notified_at ?? null,
      sms_notified_at: source.sms_notified_at ?? current?.sms_notified_at ?? null,
    });
  }
}
