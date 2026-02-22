import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { ProcessService } from '@app/core/services/process/process.service';
import {
  ProcessDetail,
  Subject,
  Action,
  ActionFilter,
  ActionResponseMeta,
  AlertKeyword,
  AlertKeywordStat,
} from '@app/core/models/process/process.model';
import { buildAnnotationWithHighlights } from '@app/core/utils/alert-highlight.utils';
import { DateRangePickerComponent, DateRange } from '@app/shared/components/date-range-picker/date-range-picker.component';
import { DataTableComponent, DataTableColumn } from '@app/shared/components/data-table/data-table.component';

@Component({
  selector: 'app-process-detail',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslocoPipe,
    DateRangePickerComponent,
    DataTableComponent,
  ],
  templateUrl: './process-detail.component.html',
  styleUrls: ['./process-detail.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessDetailComponent {
  private _processService = inject(ProcessService);
  private _route = inject(ActivatedRoute);
  private _fb = inject(FormBuilder);

  // State
  public process = signal<ProcessDetail | null>(null);
  public subjects = signal<Subject[]>([]);
  public actions = signal<Action[]>([]);
  public loading = signal<boolean>(false);
  public loadingActions = signal<boolean>(false);
  public error = signal<string | null>(null);
  public actionsPagination = signal<ActionResponseMeta | null>(null);
  /** Palabras clave de alerta para filtrar actuaciones (desde processes/:id/alert-keywords) */
  public alertKeywords = signal<AlertKeyword[]>([]);
  /** Conteo por palabra clave (desde processes/:id/alert-keyword-stats) */
  public alertKeywordStats = signal<AlertKeywordStat[]>([]);

  // Filter form for actions
  public actionFilterForm: FormGroup = this._fb.group({
    action_date_range: [null as DateRange | null],
    registration_date_range: [null as DateRange | null],
    alert_slug: [null as string | null],
    search: [''],
  });

  // Table columns for actions - will be initialized in constructor
  public actionColumns: DataTableColumn[] = [];

  constructor() {
    // Store reference to formatDate method for use in render functions
    const formatDateFn = (value: string | null | undefined): string => {
      return this.formatDate(value);
    };

    // Render para fechas de término: "-" o vacío → "–", sino valor tal cual (API puede enviar texto legible)
    const formatTermDate = (value: string | null | undefined): string => {
      if (value == null || String(value).trim() === '' || String(value).trim() === '-') return '–';
      return String(value).trim();
    };

    // Columnas: # primero, luego actuación y anotación, fechas al final (sin despacho)
    this.actionColumns = [
      {
        key: 'index',
        label: 'processDetail.actions.table.index',
        width: '56px',
        align: 'center',
        render: (value: number | undefined) => (value != null ? String(value) : '–'),
      },
      {
        key: 'action',
        label: 'processDetail.actions.table.action',
        sortable: true,
      },
      {
        key: 'annotation',
        label: 'processDetail.actions.table.annotation',
        html: true,
        render: (value: string | null, row: Action) =>
          buildAnnotationWithHighlights(row.annotation ?? value, row.alert_highlights),
      },
      {
        key: 'term_start_date',
        label: 'processDetail.actions.table.termStartDate',
        width: '140px',
        align: 'center',
        render: formatTermDate,
      },
      {
        key: 'term_end_date',
        label: 'processDetail.actions.table.termEndDate',
        width: '140px',
        align: 'center',
        render: formatTermDate,
      },
      {
        key: 'action_date',
        label: 'processDetail.actions.table.actionDate',
        width: '150px',
        align: 'center',
        render: formatDateFn,
      },
      {
        key: 'registration_date',
        label: 'processDetail.actions.table.registrationDate',
        width: '150px',
        align: 'center',
        render: formatDateFn,
      },
    ];

    this.loadProcessDetail();

    // Load alert keywords, stats and actions when process is loaded
    effect(() => {
      const process = this.process();
      if (process) {
        this.loadAlertKeywords(process.id);
        this.loadAlertKeywordStats(process.id);
        this.loadActions();
      }
    });
  }

  /**
   * Load alert keywords for the process (for filter select)
   */
  loadAlertKeywords(processId: string): void {
    this._processService.getAlertKeywords(processId).subscribe({
      next: (response) => {
        this.alertKeywords.set(response.data ?? []);
      },
      error: () => {
        this.alertKeywords.set([]);
      },
    });
  }

  /**
   * Load alert keyword stats (count per keyword) for the process
   */
  loadAlertKeywordStats(processId: string): void {
    this._processService.getAlertKeywordStats(processId).subscribe({
      next: (response) => {
        this.alertKeywordStats.set(response.data ?? []);
      },
      error: () => {
        this.alertKeywordStats.set([]);
      },
    });
  }

  /**
   * Apply filter by alert keyword and run search (UX: click on stat chip)
   */
  applyAlertFilter(slug: string): void {
    this.actionFilterForm.patchValue({ alert_slug: slug });
    this.loadActions(1, this.actionsPagination()?.per_page || 10);
  }

  /**
   * Load process detail by ID
   */
  loadProcessDetail(): void {
    const id = this._route.snapshot.paramMap.get('id');

    if (!id) {
      console.error('Process ID not found in route params');
      this.error.set('processDetail.error.idNotFound');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this._processService.getProcessDetail(id).subscribe({
      next: (response) => {
        this.process.set(response.process);
        this.subjects.set(response.subjects);
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading process detail:', error);
        this.error.set('processDetail.error.loadError');
        this.loading.set(false);
      },
    });
  }

  /**
   * Load actions with current filters
   */
  loadActions(page: number = 1, perPage: number = 10): void {
    const process = this.process();
    if (!process) return;

    this.loadingActions.set(true);

    const formValue = this.actionFilterForm.value;
    const actionDateRange: DateRange | null = formValue.action_date_range;
    const registrationDateRange: DateRange | null = formValue.registration_date_range;
    const alertSlug = formValue.alert_slug?.trim();

    const filters: ActionFilter = {
      action_date_from: actionDateRange?.from && actionDateRange.from.trim() ? actionDateRange.from : undefined,
      action_date_to: actionDateRange?.to && actionDateRange.to.trim() ? actionDateRange.to : undefined,
      registration_date_from: registrationDateRange?.from && registrationDateRange.from.trim() ? registrationDateRange.from : undefined,
      registration_date_to: registrationDateRange?.to && registrationDateRange.to.trim() ? registrationDateRange.to : undefined,
      alert_slug: alertSlug || undefined,
      search: formValue.search?.trim() || undefined,
      page,
      per_page: perPage,
    };

    // Remove empty values
    Object.keys(filters).forEach((key) => {
      const value = filters[key as keyof ActionFilter];
      if (value === '' || value === null || value === undefined) {
        delete filters[key as keyof ActionFilter];
      }
    });

    this._processService.getProcessActions(process.id, filters).subscribe({
      next: (response) => {
        this.actions.set(response.data);
        this.actionsPagination.set({
          current_page: response.current_page,
          per_page: response.per_page,
          total: response.total,
          last_page: response.last_page,
          from: response.from,
          to: response.to,
        });
        this.loadingActions.set(false);
      },
      error: (error) => {
        console.error('Error loading actions:', error);
        this.actions.set([]);
        this.actionsPagination.set(null);
        this.loadingActions.set(false);
      },
    });
  }

  /**
   * Handle search
   */
  onSearchActions(): void {
    this.loadActions(1, this.actionsPagination()?.per_page || 10);
  }

  /**
   * Handle filter reset
   */
  onResetActionFilters(): void {
    this.actionFilterForm.reset({
      action_date_range: null,
      registration_date_range: null,
      alert_slug: null,
      search: '',
    });
    this.loadActions(1, this.actionsPagination()?.per_page || 10);
  }

  /**
   * Handle page change for actions
   */
  onActionsPageChange(event: { page: number; perPage: number }): void {
    this.loadActions(event.page, event.perPage);
  }

  /**
   * Get status badge class
   */
  getStatusClass(status: string): string {
    const statusLower = status.toLowerCase();
    if (statusLower.includes('cerrado') || statusLower.includes('closed')) {
      return 'badge-neutral';
    }
    if (statusLower.includes('activo') || statusLower.includes('active')) {
      return 'badge-success';
    }
    if (statusLower.includes('pendiente') || statusLower.includes('pending')) {
      return 'badge-warning';
    }
    return 'badge';
  }

  /**
   * Format date for display (table columns, etc.)
   */
  formatDate(dateString: string | null | undefined): string {
    if (!dateString) return '-';
    
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return dateString;
      
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    } catch {
      return dateString;
    }
  }

  /**
   * Safe date display: if the API returns an ISO/parseable date we format it;
   * if it returns an already human-readable string (e.g. "8 de mayo de 2024") we show it as-is.
   * Avoids InvalidPipeArgument when using the date pipe with non-parseable strings.
   */
  formatDateSafe(value: string | null | undefined, kind: 'short' | 'shortDate'): string {
    if (!value || !value.trim()) return '–';
    const trimmed = value.trim();
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) {
      if (kind === 'short') {
        return date.toLocaleString('es-ES', {
          dateStyle: 'short',
          timeStyle: 'short',
        });
      }
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
      });
    }
    return trimmed;
  }

}
