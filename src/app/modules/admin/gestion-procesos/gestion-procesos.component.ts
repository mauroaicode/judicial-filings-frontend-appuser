import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  inject,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators, AbstractControl, ValidationErrors } from '@angular/forms';
import { TranslocoPipe } from '@jsverse/transloco';
import { ProcessService } from '@app/core/services/process/process.service';
import { Process, ProcessInstance, ProcessFilter, ProcessResponseMeta, CreateProcessResponse } from '@app/core/models/process/process.model';
import { DataTableColumn } from '@app/shared/components/data-table/data-table.component';
import { DateRangePickerComponent, DateRange } from '@app/shared/components/date-range-picker/date-range-picker.component';
import { DashboardService } from '@app/core/services/dashboard/dashboard.service';
import { DashboardStatsCardsComponent } from '../dashboard/components/dashboard-stats-cards/dashboard-stats-cards.component';
import { NotificationsDrawerComponent } from '@app/shared/components/notifications-drawer/notifications-drawer.component';
import { NotificationsDrawerStateService } from '@app/core/services/notification/notifications-drawer-state.service';
import { NotificationService } from '@app/core/services/notification/notification.service';
import type { OrganizationNotificationRow } from '@app/core/models/notification/organization-notification.model';

@Component({
  selector: 'app-gestion-procesos',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslocoPipe,
    DateRangePickerComponent,
    DashboardStatsCardsComponent,
    NotificationsDrawerComponent,
  ],
  templateUrl: './gestion-procesos.component.html',
  styleUrls: ['./gestion-procesos.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GestionProcesosComponent {
  private _processService = inject(ProcessService);
  private _dashboardService = inject(DashboardService);
  private _router = inject(Router);
  private _activatedRoute = inject(ActivatedRoute);
  private _fb = inject(FormBuilder);
  private _notificationService = inject(NotificationService);
  private _destroyRef = inject(DestroyRef);

  readonly stats = this._dashboardService.stats;
  readonly statsLoading = this._dashboardService.isLoading;
  readonly statsError = this._dashboardService.error;

  private _drawerState = inject(NotificationsDrawerStateService);

  // State
  public processes = signal<Process[]>([]);
  public loading = signal<boolean>(false);
  public pagination = signal<ProcessResponseMeta | null>(null);

  // Modal state
  public isModalOpen = signal<boolean>(false);
  public submitting = signal<boolean>(false);
  public error = signal<string | null>(null);

  // Info modal state (for multiple instances or private processes)
  public isInfoModalOpen = signal<boolean>(false);
  public infoModalData = signal<CreateProcessResponse | null>(null);

  // Add process form
  public addProcessForm: FormGroup = this._fb.group({
    process_number: ['', [Validators.required, this.validateProcessNumber]],
  });

  // Filter form
  public filterForm: FormGroup = this._fb.group({
    process_number: [''],
    court: [''],
    process_class: [''],
    plaintiff: [''],
    defendant: [''],
    status: [''],
    has_multiple_instances: [null as boolean | null],
    process_date_range: [null as DateRange | null],
    created_at_range: [null as DateRange | null],
    last_api_update_range: [null as DateRange | null],
  });

  /** IDs de procesos con fila expandida (mostrar instancias) */
  public expandedProcessIds = signal<Set<string>>(new Set());
  /** ID de la fila bajo el cursor: process.id (fila principal) o instance.id (fila instancia) */
  public hoveredRowId = signal<string | null>(null);

  // Filter Visibility
  public showFilters = signal<boolean>(false);

  /**
   * Toggle filter visibility
   */
  public toggleFilters(): void {
    this.showFilters.update(v => !v);
    if (this.showFilters()) {
      setTimeout(() => {
        document.getElementById('filters-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 50);
    }
  }

  // Table columns
  public columns: DataTableColumn[] = [
    {
      key: 'index',
      label: 'gestionProcesos.table.index',
      width: '60px',
      align: 'center',
    },
    {
      key: 'process_number',
      label: 'gestionProcesos.table.processNumber',
      width: '240px',
      align: 'left',
      sortable: true,
    },
    {
      key: 'court',
      label: 'gestionProcesos.table.court',
      sortable: true,
    },
    {
      key: 'process_class',
      label: 'gestionProcesos.table.processClass',
      width: '200px',
    },
    {
      key: 'status_label',
      label: 'gestionProcesos.table.status',
      width: '120px',
      align: 'center',
    },
    {
      key: 'plaintiff',
      label: 'gestionProcesos.table.plaintiff',
      width: '200px',
    },
    {
      key: 'defendant',
      label: 'gestionProcesos.table.defendant',
      width: '200px',
    },
    {
      key: 'has_multiple_instances',
      label: 'gestionProcesos.table.multipleInstances',
      width: '150px',
      align: 'center',
      render: (value: boolean) => value ? 'Sí' : 'No',
    },
    {
      key: 'created_at',
      label: 'gestionProcesos.table.processDate',
      width: '120px',
      align: 'center',
    },
    {
      key: 'last_activity_date',
      label: 'gestionProcesos.table.lastActivityDate',
      width: '120px',
      align: 'center',
    },
  ];

  constructor() {
    this._loadFiltersFromQueryParams();
    this.loadProcesses();

    // Subscribe to process refresh events (WebSocket notifications)
    this._notificationService.refreshProcesses$
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(() => {
        console.log('Refreshing process list because of a notification...');
        this.loadProcesses(this.pagination()?.current_page || 1, this.pagination()?.per_page || 20);
      });
  }

  /**
   * Load filters from query params
   */
  private _loadFiltersFromQueryParams(): void {
    const queryParams = this._activatedRoute.snapshot.queryParams;

    // Helper to check if a value is valid (not null, not "null" string, not empty)
    const isValidValue = (value: any): boolean => {
      return value !== null && value !== undefined && value !== '' && value !== 'null';
    };

    // Apply query params to form - only if they have valid values
    if (isValidValue(queryParams['process_number'])) {
      this.filterForm.patchValue({ process_number: queryParams['process_number'] });
    }
    if (isValidValue(queryParams['court'])) {
      this.filterForm.patchValue({ court: queryParams['court'] });
    }
    if (isValidValue(queryParams['process_class'])) {
      this.filterForm.patchValue({ process_class: queryParams['process_class'] });
    }
    if (isValidValue(queryParams['plaintiff'])) {
      this.filterForm.patchValue({ plaintiff: queryParams['plaintiff'] });
    }
    if (isValidValue(queryParams['defendant'])) {
      this.filterForm.patchValue({ defendant: queryParams['defendant'] });
    }
    if (isValidValue(queryParams['status'])) {
      this.filterForm.patchValue({ status: queryParams['status'] });
    }
    if (isValidValue(queryParams['has_multiple_instances'])) {
      this.filterForm.patchValue({ has_multiple_instances: queryParams['has_multiple_instances'] === 'true' });
    }
    // Load date ranges from query params - only if they have valid values
    if (isValidValue(queryParams['process_date_from']) || isValidValue(queryParams['process_date_to'])) {
      const dateRange: DateRange = {
        from: isValidValue(queryParams['process_date_from']) ? queryParams['process_date_from'] : null,
        to: isValidValue(queryParams['process_date_to']) ? queryParams['process_date_to'] : null,
      };
      this.filterForm.patchValue({ process_date_range: dateRange });
    }
    if (isValidValue(queryParams['created_at_from']) || isValidValue(queryParams['created_at_to'])) {
      const dateRange: DateRange = {
        from: isValidValue(queryParams['created_at_from']) ? queryParams['created_at_from'] : null,
        to: isValidValue(queryParams['created_at_to']) ? queryParams['created_at_to'] : null,
      };
      this.filterForm.patchValue({ created_at_range: dateRange });
    }
    if (isValidValue(queryParams['last_api_update_from']) || isValidValue(queryParams['last_api_update_to'])) {
      const dateRange: DateRange = {
        from: isValidValue(queryParams['last_api_update_from']) ? queryParams['last_api_update_from'] : null,
        to: isValidValue(queryParams['last_api_update_to']) ? queryParams['last_api_update_to'] : null,
      };
      this.filterForm.patchValue({ last_api_update_range: dateRange });
    }
  }

  /**
   * Update query params with current filters
   */
  private _updateQueryParams(filters: ProcessFilter, includePage: boolean = false, page: number = 1): void {
    const queryParams: Record<string, string> = {};

    // Only add params if they have actual values (not null, not empty, not undefined)
    if (filters.process_number && filters.process_number.trim()) {
      queryParams['process_number'] = filters.process_number;
    }
    if (filters.court && filters.court.trim()) {
      queryParams['court'] = filters.court;
    }
    if (filters.process_class && filters.process_class.trim()) {
      queryParams['process_class'] = filters.process_class;
    }
    if (filters.plaintiff && filters.plaintiff.trim()) {
      queryParams['plaintiff'] = filters.plaintiff;
    }
    if (filters.defendant && filters.defendant.trim()) {
      queryParams['defendant'] = filters.defendant;
    }
    if (filters.status && filters.status.trim()) {
      queryParams['status'] = filters.status;
    }
    if (filters.has_multiple_instances !== undefined && filters.has_multiple_instances !== null) {
      queryParams['has_multiple_instances'] = filters.has_multiple_instances.toString();
    }
    if (filters.process_date_from && filters.process_date_from.trim()) {
      queryParams['process_date_from'] = filters.process_date_from;
    }
    if (filters.process_date_to && filters.process_date_to.trim()) {
      queryParams['process_date_to'] = filters.process_date_to;
    }
    if (filters.created_at_from && filters.created_at_from.trim()) {
      queryParams['created_at_from'] = filters.created_at_from;
    }
    if (filters.created_at_to && filters.created_at_to.trim()) {
      queryParams['created_at_to'] = filters.created_at_to;
    }
    if (filters.last_api_update_from && filters.last_api_update_from.trim()) {
      queryParams['last_api_update_from'] = filters.last_api_update_from;
    }
    if (filters.last_api_update_to && filters.last_api_update_to.trim()) {
      queryParams['last_api_update_to'] = filters.last_api_update_to;
    }

    if (includePage && page > 1) {
      queryParams['page'] = page.toString();
    }

    // Build final params - only include params with actual values
    // When we pass only the params we want, Angular Router will replace ALL query params
    // This means params not in this object will be automatically removed
    const finalParams: Record<string, string> = { ...queryParams };

    // Add page if needed
    if (includePage && page > 1) {
      finalParams['page'] = page.toString();
    }

    // Navigate - Angular Router will replace all query params with only those in finalParams
    // This automatically removes any params not in finalParams (including "null" strings)
    this._router.navigate([], {
      relativeTo: this._activatedRoute,
      queryParams: finalParams,
      replaceUrl: true,
    });
  }

  /**
   * Load processes with current filters
   */
  loadProcesses(page: number = 1, perPage: number = 20): void {
    this.loading.set(true);

    const formValue = this.filterForm.value;
    const processDateRange: DateRange | null = formValue.process_date_range;
    const createdAtRange: DateRange | null = formValue.created_at_range;
    const lastApiUpdateRange: DateRange | null = formValue.last_api_update_range;

    const filters: ProcessFilter = {
      process_number: formValue.process_number?.trim() || undefined,
      court: formValue.court?.trim() || undefined,
      process_class: formValue.process_class?.trim() || undefined,
      plaintiff: formValue.plaintiff?.trim() || undefined,
      defendant: formValue.defendant?.trim() || undefined,
      status: formValue.status?.trim() || undefined,
      has_multiple_instances: formValue.has_multiple_instances !== null && formValue.has_multiple_instances !== '' ? formValue.has_multiple_instances : undefined,
      process_date_from: processDateRange?.from && processDateRange.from.trim() ? processDateRange.from : undefined,
      process_date_to: processDateRange?.to && processDateRange.to.trim() ? processDateRange.to : undefined,
      created_at_from: createdAtRange?.from && createdAtRange.from.trim() ? createdAtRange.from : undefined,
      created_at_to: createdAtRange?.to && createdAtRange.to.trim() ? createdAtRange.to : undefined,
      last_api_update_from: lastApiUpdateRange?.from && lastApiUpdateRange.from.trim() ? lastApiUpdateRange.from : undefined,
      last_api_update_to: lastApiUpdateRange?.to && lastApiUpdateRange.to.trim() ? lastApiUpdateRange.to : undefined,
      page,
      per_page: perPage,
    };

    // Remove empty values, but keep date range params if at least one is set
    Object.keys(filters).forEach((key) => {
      const value = filters[key as keyof ProcessFilter];
      if (value === '' || value === null || value === undefined) {
        delete filters[key as keyof ProcessFilter];
      }
    });

    this._updateQueryParams(filters, false);
    // Dashboard stats must follow the same active filters (without pagination)
    const { page: _page, per_page: _perPage, ...statsFilters } = filters;
    this._dashboardService.loadStats(statsFilters);

    this._processService.getProcesses(filters).subscribe({
      next: (response) => {
        this.processes.set(response.data);
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
        console.error('Error loading processes:', error);
        this.loading.set(false);
      },
    });
  }

  /**
   * Handle search
   */
  onSearch(): void {
    this.loadProcesses(1, this.pagination()?.per_page || 20);
  }

  /**
   * Handle filter reset
   */
  onResetFilters(): void {
    this.filterForm.reset({
      process_number: '',
      court: '',
      process_class: '',
      plaintiff: '',
      defendant: '',
      status: '',
      has_multiple_instances: null,
      process_date_range: null,
      created_at_range: null,
      last_api_update_range: null,
    });

    // Navigate with empty query params (no null values, just empty object)
    this._router.navigate([], {
      relativeTo: this._activatedRoute,
      queryParams: {},
      replaceUrl: true,
    });
    this.loadProcesses(1, this.pagination()?.per_page || 20);
  }

  /**
   * Handle page change
   */
  onPageChange(event: { page: number; perPage: number }): void {
    this.loadProcesses(event.page, event.perPage);
  }

  /**
   * Expandir/colapsar fila de proceso (solo cuando tiene múltiples instancias)
   */
  toggleExpand(process: Process): void {
    if (!process.has_multiple_instances || !process.instances?.length) return;
    const next = new Set(this.expandedProcessIds());
    if (next.has(process.id)) {
      next.delete(process.id);
    } else {
      next.add(process.id);
    }
    this.expandedProcessIds.set(next);
  }

  /**
   * Navegar al detalle del proceso (doble clic en fila principal o en instancia)
   */
  onRowDblClick(row: Process | ProcessInstance): void {
    this._router.navigate(['/gestion-procesos', row.id]);
  }

  /**
   * Indica si la fila del proceso está expandida
   */
  isExpanded(process: Process): boolean {
    return this.expandedProcessIds().has(process.id);
  }

  /**
   * Cantidad de instancias de un proceso.
   * Si no hay arreglo de instancias, se asume 1 (la instancia principal).
   */
  getInstanceCount(process: Process): number {
    if (process.instances && process.instances.length > 0) return process.instances.length;
    return 1;
  }

  /**
   * Helper para mostrar demandante/demandado: texto principal, (+N) en accent y tooltip ordenado
   */
  getPartyDisplay(list: string[] | null | undefined): { mainText: string; extraCount: number; tooltipText: string; fullList: string[] } {
    const arr = list?.filter(Boolean) ?? [];
    if (arr.length === 0) return { mainText: '', extraCount: 0, tooltipText: '', fullList: [] };
    const mainText = arr[0];
    const extraCount = arr.length - 1;
    const tooltipText = arr.map((name, i) => `${i + 1}. ${name}`).join('\n');
    return { mainText, extraCount, tooltipText, fullList: arr };
  }

  /**
   * Valor de celda para una fila (proceso o instancia)
   */
  getProcessCellValue(row: Process | ProcessInstance, column: DataTableColumn): string | number | boolean | null {
    const record = row as unknown as Record<string, unknown>;
    if (column.render) {
      return column.render(record[column.key], row) as string;
    }
    const value = record[column.key];
    return value != null ? value as string | number | boolean : null;
  }

  /**
   * Formatear fecha para tabla (si viene en formato ISO; si no, mostrar tal cual)
   */
  formatProcessDate(dateString: string | null | undefined): string {
    if (!dateString) return '–';
    const s = String(dateString).trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
      const d = new Date(s);
      return isNaN(d.getTime()) ? s : d.toLocaleDateString('es-ES', { year: 'numeric', month: '2-digit', day: '2-digit' });
    }
    return s;
  }

  /** Opciones de tamaño de página para la paginación */
  pageSizeOptions = [10, 20, 25, 50, 100];

  /**
   * Números de página a mostrar en la paginación
   */
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
      else start = Math.max(1, end - 4);
    }
    for (let i = start; i <= end; i++) pages.push(i);
    return pages;
  }

  onNotificationsDrawerClosed(): void {
    this._drawerState.closeDrawer();
  }

  onNotificationRowClick(row: OrganizationNotificationRow): void {
    if (row?.process_id) {
      this._drawerState.closeDrawer();
      this._router.navigate(['/gestion-procesos', row.process_id]);
    }
  }

  /**
   * Custom validator for process number (23 digits, numeric only)
   */
  validateProcessNumber(control: AbstractControl): ValidationErrors | null {
    const value = control.value;
    if (!value) {
      return null; // Let required validator handle empty values
    }

    // Check if it's exactly 23 digits
    const numericRegex = /^\d{23}$/;
    if (!numericRegex.test(value)) {
      return { invalidProcessNumber: true };
    }

    return null;
  }

  /**
   * Open add process modal
   */
  openAddProcessModal(): void {
    this.isModalOpen.set(true);
    this.error.set(null);
    this.addProcessForm.reset();
  }

  /**
   * Close add process modal
   */
  closeAddProcessModal(): void {
    this.isModalOpen.set(false);
    this.error.set(null);
    this.addProcessForm.reset();
  }

  /**
   * Submit add process form
   */
  onSubmitAddProcess(): void {
    if (this.addProcessForm.invalid) {
      this.addProcessForm.markAllAsTouched();
      return;
    }

    this.submitting.set(true);
    this.error.set(null);

    const processNumber = this.addProcessForm.get('process_number')?.value?.trim();

    this._processService.createProcess(processNumber).subscribe({
      next: (response) => {
        this.submitting.set(false);
        this.closeAddProcessModal();

        // Always reload processes table
        this.loadProcesses(1, this.pagination()?.per_page || 20);

        // Normalizamos la respuesta por si la API retorna el nuevo formato de array o el antiguo singular
        const responseData = { ...response };
        if (response.processes && response.processes.length > 0) {
          responseData.process = response.processes[0];
          responseData.total_processes = response.total_processes ?? response.processes.length;
          responseData.registered_count = response.registered_count ?? response.processes.length;
          responseData.has_multiple_instances = response.has_multiple_instances ?? (response.processes.length > 1);
        }

        // Siempre mostramos el modal de información para que el usuario vea los detalles del radicado registrado
        this.infoModalData.set(responseData);
        this.isInfoModalOpen.set(true);
      },
      error: (error) => {
        this.submitting.set(false);

        // Handle error response
        if (error.error && error.error.messages && Array.isArray(error.error.messages)) {
          // Join all error messages
          this.error.set(error.error.messages.join('. '));
        } else if (error.error && error.error.message) {
          this.error.set(error.error.message);
        } else {
          this.error.set('gestionProcesos.addProcess.error.generic');
        }
      },
    });
  }

  /**
   * Close info modal
   */
  closeInfoModal(): void {
    this.isInfoModalOpen.set(false);
    this.infoModalData.set(null);
  }

  /**
   * Navigate to process detail
   */
  navigateToDetail(id: string): void {
    this.closeInfoModal();
    this._router.navigate(['/gestion-procesos', id]);
  }

  /**
   * Get error message for process number field
   */
  getProcessNumberError(): string {
    const control = this.addProcessForm.get('process_number');
    if (control?.hasError('required') && control?.touched) {
      return 'gestionProcesos.addProcess.errors.required';
    }
    if (control?.hasError('invalidProcessNumber') && control?.touched) {
      return 'gestionProcesos.addProcess.errors.invalidFormat';
    }
    return '';
  }

  /**
   * Only allow numeric input
   */
  onProcessNumberInput(event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = input.value;
    // Remove any non-numeric characters
    const numericValue = value.replace(/\D/g, '');
    // Limit to 23 digits
    const limitedValue = numericValue.slice(0, 23);

    if (value !== limitedValue) {
      input.value = limitedValue;
      this.addProcessForm.patchValue({ process_number: limitedValue }, { emitEvent: false });
    }
  }
}
