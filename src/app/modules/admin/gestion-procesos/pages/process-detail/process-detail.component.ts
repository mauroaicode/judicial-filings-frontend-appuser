import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  signal,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ProcessService } from '@app/core/services/process/process.service';
import {
  ProcessDetail,
  Subject,
  Action,
  ActionFilter,
  ActionResponseMeta,
} from '@app/core/models/process/process.model';
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
  private _router = inject(Router);
  private _translocoService = inject(TranslocoService);
  private _fb = inject(FormBuilder);

  // State
  public process = signal<ProcessDetail | null>(null);
  public subjects = signal<Subject[]>([]);
  public actions = signal<Action[]>([]);
  public loading = signal<boolean>(false);
  public loadingActions = signal<boolean>(false);
  public error = signal<string | null>(null);
  public actionsPagination = signal<ActionResponseMeta | null>(null);

  // Filter form for actions
  public actionFilterForm: FormGroup = this._fb.group({
    action_date_range: [null as DateRange | null],
    registration_date_range: [null as DateRange | null],
    search: [''],
  });

  // Table columns for actions - will be initialized in constructor
  public actionColumns: DataTableColumn[] = [];

  constructor() {
    // Store reference to formatDate method for use in render functions
    const formatDateFn = (value: string | null | undefined): string => {
      return this.formatDate(value);
    };

    // Initialize action columns with date formatting
    this.actionColumns = [
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
      {
        key: 'action',
        label: 'processDetail.actions.table.action',
        sortable: true,
      },
      {
        key: 'annotation',
        label: 'processDetail.actions.table.annotation',
        render: (value: string | null) => value || '-',
      },
      {
        key: 'court',
        label: 'processDetail.actions.table.court',
        width: '200px',
      },
    ];

    this.loadProcessDetail();

    // Load actions when process is loaded
    effect(() => {
      const process = this.process();
      if (process) {
        this.loadActions();
      }
    });
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

    const filters: ActionFilter = {
      action_date_from: actionDateRange?.from && actionDateRange.from.trim() ? actionDateRange.from : undefined,
      action_date_to: actionDateRange?.to && actionDateRange.to.trim() ? actionDateRange.to : undefined,
      registration_date_from: registrationDateRange?.from && registrationDateRange.from.trim() ? registrationDateRange.from : undefined,
      registration_date_to: registrationDateRange?.to && registrationDateRange.to.trim() ? registrationDateRange.to : undefined,
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
   * Format date for display
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

}
