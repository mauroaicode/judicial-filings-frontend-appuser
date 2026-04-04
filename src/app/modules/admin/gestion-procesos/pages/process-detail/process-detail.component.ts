import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { ProcessNumberPipe } from '@app/shared/pipes/process-number.pipe';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProcessService } from '@app/core/services/process/process.service';
import {
  ProcessDetail,
  ProcessDetailInstance,
  Subject,
  Action,
  ActionFilter,
  ActionResponseMeta,
  AlertKeyword,
  AlertKeywordStat,
} from '@app/core/models/process/process.model';
import { buildTextWithHighlights } from '@app/core/utils/alert-highlight.utils';
import { DateRangePickerComponent, DateRange } from '@app/shared/components/date-range-picker/date-range-picker.component';
import { DataTableComponent, DataTableColumn } from '@app/shared/components/data-table/data-table.component';
import { ConfirmationDialogComponent } from '@app/shared/components/confirmation-dialog/confirmation-dialog.component';
import { ProcessAlertTooltipComponent } from '@app/shared/components/process-alert-tooltip/process-alert-tooltip.component';

@Component({
  selector: 'app-process-detail',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslocoPipe,
    DateRangePickerComponent,
    DataTableComponent,
    ConfirmationDialogComponent,
    ProcessNumberPipe,
    ProcessAlertTooltipComponent,
  ],
  templateUrl: './process-detail.component.html',
  styleUrls: ['./process-detail.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessDetailComponent {
  private _processService = inject(ProcessService);
  private _route = inject(ActivatedRoute);
  private _router = inject(Router);
  private _fb = inject(FormBuilder);
  private _destroyRef = inject(DestroyRef);

  // State
  public process = signal<ProcessDetail | null>(null);
  public processInstances = signal<ProcessDetailInstance[]>([]);
  public loadingInstances = signal<boolean>(false);
  public subjects = signal<Subject[]>([]);
  public plaintiffSubjects = computed(() =>
    this.subjects().filter((s) => s.subject_type?.toLowerCase().includes('demandante'))
  );
  public defendantSubjects = computed(() =>
    this.subjects().filter((s) => s.subject_type?.toLowerCase().includes('demandado'))
  );
  public actions = signal<Action[]>([]);
  public loading = signal<boolean>(false);
  public loadingActions = signal<boolean>(false);
  public error = signal<string | null>(null);
  public actionsPagination = signal<ActionResponseMeta | null>(null);
  /** Palabras clave de alerta para filtrar actuaciones (desde processes/:id/alert-keywords) */
  public alertKeywords = signal<AlertKeyword[]>([]);
  /** Conteo por palabra clave (desde processes/:id/alert-keyword-stats) */
  public alertKeywordStats = signal<AlertKeywordStat[]>([]);
  /** Estado inicial del proceso (para mantener el status_label original) */
  public initialStatusLabel = signal<string>('');
  /** Estado del modal de confirmación */
  public confirmModalOpen = signal<boolean>(false);
  public confirmModalTitle = signal<string>('');
  public confirmModalMessage = signal<string>('');
  public confirmModalAction = signal<'activate' | 'deactivate'>('deactivate');

  /** Estado del mensaje de copiado (idéntico a Actuaciones Recientes) */
  public copiedMessage = signal<string | null>(null);
  /** Estado del toast (para otros mensajes) */
  public toastVisible = signal<boolean>(false);
  public toastType = signal<'success' | 'error'>('success');
  public toastMessage = signal<string>('');

  /** Selector de instancia en móvil */
  public showInstanceSelector = signal<boolean>(false);

  /** Instancia actualmente seleccionada */
  public selectedInstance = computed(() =>
    this.processInstances().find(instance => instance.id === this.process()?.id)
  );

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
        html: true,
        render: (value: string | null, row: Action) =>
          buildTextWithHighlights(row.action ?? value, row.alert_highlights, 'action'),
      },
      {
        key: 'annotation',
        label: 'processDetail.actions.table.annotation',
        html: true,
        render: (value: string | null, row: Action) =>
          buildTextWithHighlights(row.annotation ?? value, row.alert_highlights, 'annotation'),
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

    this._route.paramMap
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((params) => {
        const id = params.get('id');
        this.loadProcessDetail(id);
      });

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
   * Copy text to clipboard (removes spaces and dashes)
   */
  public copyToClipboard(text: string, event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    
    if (!text || text === '–') return;
    
    // Remove dashes and spaces as requested
    const cleanText = text.replace(/[^0-9]/g, '');
    
    navigator.clipboard.writeText(cleanText).then(() => {
      this.copiedMessage.set('Radicado copiado!');
      setTimeout(() => this.copiedMessage.set(null), 2500);
    });
  }

  /**
   * Load process detail by ID
   */
  loadProcessDetail(id: string | null): void {
    if (!id) {
      console.error('Process ID not found in route params');
      this.error.set('processDetail.error.idNotFound');
      this.loading.set(false);
      return;
    }

    this.process.set(null);
    this.processInstances.set([]);
    this.subjects.set([]);
    this.actions.set([]);
    this.actionsPagination.set(null);
    this.loading.set(true);
    this.error.set(null);

    this._processService.getProcessDetail(id).subscribe({
      next: (response) => {
        this.process.set(response.process);
        // Guardar el status_label inicial para el badge
        this.initialStatusLabel.set(response.process.status_label);
        this.subjects.set(response.subjects);
        if (response.process.has_multiple_instances) {
          this.loadProcessInstances(response.process.id);
        } else {
          this.processInstances.set([]);
        }
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading process detail:', error);
        this.error.set('processDetail.error.loadError');
        this.loading.set(false);
      },
    });
  }

  loadProcessInstances(processId: string): void {
    this.loadingInstances.set(true);
    this._processService.getProcessInstances(processId).subscribe({
      next: (instances) => {
        this.processInstances.set(instances ?? []);
        this.loadingInstances.set(false);
      },
      error: () => {
        this.processInstances.set([]);
        this.loadingInstances.set(false);
      },
    });
  }

  isSelectedInstance(instanceId: string): boolean {
    return this.process()?.id === instanceId;
  }

  onSelectInstance(instanceId: string): void {
    if (this.isSelectedInstance(instanceId)) {
      this.showInstanceSelector.set(false);
      return;
    }
    this.showInstanceSelector.set(false);
    this._router.navigate(['/gestion-procesos', instanceId]);
  }

  toggleInstanceSelector(): void {
    this.showInstanceSelector.update(v => !v);
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
   * Toggle process status (activate/deactivate)
   */
  toggleProcessStatus(): void {
    const process = this.process();
    if (!process) return;

    const currentStatus = this.initialStatusLabel() || process.status_label;
    const statusLower = currentStatus.toLowerCase();

    // Verificar "inactivo" primero porque contiene "activo"
    const isCurrentlyActive = !statusLower.includes('inactivo') && !statusLower.includes('inactive');

    // Set values for confirmation modal
    this.confirmModalTitle.set(isCurrentlyActive ? 'Desactivar Proceso' : 'Activar Proceso');
    this.confirmModalMessage.set(
      isCurrentlyActive
        ? '¿Está seguro de desactivar este proceso? Ya no se realizará seguimiento automático de las actualizaciones.'
        : '¿Está seguro de activar este proceso? Se reanudará el seguimiento automático de las actualizaciones.'
    );
    this.confirmModalAction.set(isCurrentlyActive ? 'deactivate' : 'activate');
    this.confirmModalOpen.set(true);
  }

  /**
   * Handle confirmation from modal
   */
  onConfirmStatusChange(): void {
    const process = this.process();
    if (!process) return;

    const action = this.confirmModalAction();
    const isActivate = action === 'activate';

    this._processService.updateProcessStatus(process.id, isActivate).subscribe({
      next: (response) => {
        // Actualizar el estado del proceso
        const newStatus = isActivate ? 'Activo' : 'Inactivo';
        this.initialStatusLabel.set(newStatus);
        this.process.set({
          ...process,
          status_label: newStatus
        });
        this.confirmModalOpen.set(false);

        // Show success toast
        this.showToast('success', response.message);

        // Reload the page after 1.5 seconds
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      },
      error: (error) => {
        console.error('Error changing process status:', error);
        this.confirmModalOpen.set(false);
        this.showToast('error', 'Error al cambiar el estado del proceso');
      }
    });
  }

  /**
   * Handle cancel from modal
   */
  onCancelStatusChange(): void {
    this.confirmModalOpen.set(false);
  }

  /**
   * Show toast notification
   */
  showToast(type: 'success' | 'error', message: string): void {
    this.toastType.set(type);
    this.toastMessage.set(message);
    this.toastVisible.set(true);

    // Auto hide after 3 seconds
    setTimeout(() => {
      this.toastVisible.set(false);
    }, 3000);
  }

  /**
   * Check if process is inactive
   */
  isProcessInactive(): boolean {
    const status = this.initialStatusLabel() || this.process()?.status_label;
    if (!status) return false;
    const statusLower = status.toLowerCase();
    return statusLower.includes('inactivo') || statusLower.includes('inactive');
  }

  /**
   * Get status badge class - usa el estado inicial del proceso
   */
  getStatusClass(status: string): string {
    const statusLower = status.toLowerCase();

    if (statusLower.includes('inactivo') || statusLower.includes('inactive')) {
      return 'badge badge-error';
    }

    if (statusLower.includes('activo') || statusLower.includes('active')) {
      return 'badge badge-success';
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
  formatDateSafe(value: string | null | undefined, kind: 'short' | 'shortDate' | 'onlyTime'): string {
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
      if (kind === 'onlyTime') {
        return date.toLocaleTimeString('es-ES', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true
        });
      }
      return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        day: '2-digit',
        month: '2-digit',
      });
    }

    // If not a parseable date (already formatted from API), don't duplicate for onlyTime
    return kind === 'onlyTime' ? '' : trimmed;
  }

}
