import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
  computed,
  ViewEncapsulation,
} from '@angular/core';
import { ProcessNumberPipe } from '../../../shared/pipes/process-number.pipe';
import { SafeHtmlPipe } from '../../../shared/pipes/safe-html.pipe';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute } from '@angular/router';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslocoService, TranslocoPipe } from '@jsverse/transloco';
import { NotificationDigestService } from '@app/core/services/notification/notification-digest.service';
import {
  Movement,
  NotificationDigestFilter,
  NotificationDigestResponse,
} from '@app/core/models/notification/notification-digest.model';
import { DataTableColumn, DataTableComponent, PaginationInfo } from '@app/shared/components/data-table/data-table.component';
import { DateRangePickerComponent, DateRange } from '@app/shared/components/date-range-picker/date-range-picker.component';
import { buildTextWithHighlights } from '@app/core/utils/alert-highlight.utils';
import { LiveClockComponent } from '@app/shared/components/live-clock/live-clock.component';

@Component({
  selector: 'app-actuaciones-recientes',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    TranslocoPipe,
    DateRangePickerComponent,
    ProcessNumberPipe,
    SafeHtmlPipe,
    LiveClockComponent,
  ],
  templateUrl: './actuaciones-recientes.component.html',
  styleUrls: ['./actuaciones-recientes.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActuacionesRecientesComponent {
  private _digestService = inject(NotificationDigestService);
  private _router = inject(Router);
  private _activatedRoute = inject(ActivatedRoute);
  private _fb = inject(FormBuilder);
  private _transloco = inject(TranslocoService);

  // State
  public movements = signal<Movement[]>([]);
  public pagedMovements = computed(() => {
    const list = this.movements();
    const pag = this.pagination();
    if (!pag) return list;

    // Si la cantidad de datos recibidos es mayor al per_page solicitado, 
    // hacemos una paginación en el cliente como respaldo (en caso de que el backend ignore el limit).
    if (list.length > pag.per_page) {
      const start = (pag.current_page - 1) * pag.per_page;
      return list.slice(start, start + pag.per_page);
    }
    return list;
  });

  public loading = signal<boolean>(false);
  public pagination = signal<PaginationInfo | null>(null);
  public pageSizeOptions = [10, 20, 50, 100];
  public copiedMessage = signal<string | null>(null);
  public hoveredRowId = signal<string | null>(null);
  /** Control de la modal de leyenda en mobile */
  public showLegendModal = signal<boolean>(false);
  /** Control de la modal de detalle del movimiento */
  public showMovementModal = signal<boolean>(false);
  public selectedMovement = signal<Movement | null>(null);

  // Filter Visibility
  public showFilters = signal<boolean>(false);
  
  // Highlight switch
  public showHighlights = signal<boolean>(true);

  // Filter form
  public filterForm: FormGroup = this._fb.group({
    process_number: [''],
    registration_date_range: [null as DateRange | null],
    term_start_date_range: [null as DateRange | null],
    term_end_date_range: [null as DateRange | null],
  });

  /** Identifica si hay filtros aplicados para cambiar el mensaje de tabla vacía */
  public isFiltered = computed(() => {
    const formValue = this.filterForm.value;
    return !!(
      formValue.process_number?.trim() ||
      formValue.registration_date_range?.from ||
      formValue.term_start_date_range?.from ||
      formValue.term_end_date_range?.from
    );
  });

  // Table columns
  public columns: DataTableColumn[] = [
    {
      key: 'alert_status',
      label: 'actuacionesRecientes.table.alertLevel',
      width: '80px',
      align: 'center',
      html: true,
      render: (value: any, row: Movement, index?: number) => this._renderAlertCell(row, index),
    },
    {
      key: 'process_number',
      label: 'actuacionesRecientes.table.processNumber',
      width: '280px',
      align: 'left',
      sortable: true,
    },
    {
      key: 'court',
      label: 'actuacionesRecientes.table.court',
      width: '750px', // Aumentado aún más a petición del usuario
      sortable: true,
    },
    {
      key: 'plaintiffs',
      label: 'actuacionesRecientes.table.plaintiff',
      width: '200px',
      html: true,
      render: (value: string[]) => this._renderPartyCell(value),
    },
    {
      key: 'defendants',
      label: 'actuacionesRecientes.table.defendant',
      width: '200px',
      html: true,
      render: (value: string[]) => this._renderPartyCell(value),
    },
    {
      key: 'registration_date',
      label: 'actuacionesRecientes.table.registrationDate',
      width: '120px',
      align: 'center',
    },
    {
      key: 'term_start_date',
      label: 'actuacionesRecientes.table.termStartDate',
      width: '120px',
      align: 'center',
      render: (value: string) => value || '–',
    },
    {
      key: 'term_end_date',
      label: 'actuacionesRecientes.table.termEndDate',
      width: '120px',
      align: 'center',
      render: (value: string) => value || '–',
    },
    {
      key: 'action_text',
      label: 'actuacionesRecientes.table.action',
      width: '350px',
      html: true,
      render: (value: string, row: Movement, index?: number) => this.renderActionCell(row, index),
    },
  ];

  constructor() {
    this._loadFiltersFromQueryParams();
  }

  /**
   * Load filters from query params
   */
  private _loadFiltersFromQueryParams(): void {
    const queryParams = this._activatedRoute.snapshot.queryParams;

    if (queryParams['process_number']) {
      this.filterForm.patchValue({ process_number: queryParams['process_number'] });
    }

    if (queryParams['registration_date_from'] || queryParams['registration_date_to']) {
      this.filterForm.patchValue({
        registration_date_range: {
          from: queryParams['registration_date_from'] || null,
          to: queryParams['registration_date_to'] || null,
        },
      });
    }

    if (queryParams['term_start_date_from'] || queryParams['term_start_date_to']) {
      this.filterForm.patchValue({
        term_start_date_range: {
          from: queryParams['term_start_date_from'] || null,
          to: queryParams['term_start_date_to'] || null,
        },
      });
    }

    if (queryParams['term_end_date_from'] || queryParams['term_end_date_to']) {
      this.filterForm.patchValue({
        term_end_date_range: {
          from: queryParams['term_end_date_from'] || null,
          to: queryParams['term_end_date_to'] || null,
        },
      });
    }

    // Si hay per_page en URL, lo usamos (o 10 por defecto)
    const perPage = queryParams['per_page'] ? parseInt(queryParams['per_page'], 10) : 10;

    // Si hay filtros aplicados, abrimos la sección de filtros
    if (
      queryParams['process_number'] ||
      queryParams['registration_date_from'] ||
      queryParams['term_start_date_from'] ||
      queryParams['term_end_date_from']
    ) {
      this.showFilters.set(true);
    }
    
    // Cargamos inicial con los params de la URL
    this.loadMovements(queryParams['page'] ? parseInt(queryParams['page'], 10) : 1, perPage);
  }

  /**
   * Load movements with current filters
   */
  loadMovements(page: number = 1, perPage: number = 10): void {
    this.loading.set(true);

    const formValue = this.filterForm.value;
    const registrationDateRange: DateRange | null = formValue.registration_date_range;
    const termStartDateRange: DateRange | null = formValue.term_start_date_range;
    const termEndDateRange: DateRange | null = formValue.term_end_date_range;

    const filters: NotificationDigestFilter = {
      process_number: formValue.process_number?.trim() || undefined,
      registration_date_from: registrationDateRange?.from || undefined,
      registration_date_to: registrationDateRange?.to || undefined,
      term_start_date_from: termStartDateRange?.from || undefined,
      term_start_date_to: termStartDateRange?.to || undefined,
      term_end_date_from: termEndDateRange?.from || undefined,
      term_end_date_to: termEndDateRange?.to || undefined,
      page,
      per_page: perPage,
    };

    this._updateQueryParams(filters);

    this._digestService.getNotificationDigests(filters).subscribe({
      next: (response) => {
        const rawMovements = response.data.flatMap((digest, dIndex) => 
          digest.data.map((m, mIndex) => ({ 
            ...m, 
            id: m.id || `${digest.id}-${mIndex}`, // Garantizar ID único para el hover
            digest_created_at: digest.created_at 
          }))
        );

        // Grouping logic: Consolidate "Fijacion Estado" with its "Auto"
        const movementMap = new Map<string, Movement>();
        rawMovements.forEach(m => {
          if (m.id) movementMap.set(m.id, m);
          // Also index by process_action_id if present (backend uses this for notified_action_id)
          if (m.process_action_id) movementMap.set(m.process_action_id, m);
        });

        const finalMovements: Movement[] = [];
        const groupedIds = new Set<string>();

        rawMovements.forEach(m => {
          if (groupedIds.has(m.id!)) return;

          // If it's a Fijacion Estado that points to an Auto
          if (m.action_text?.toLowerCase().includes('fijacion estado') && m.notified_action_id) {
            const auto = movementMap.get(m.notified_action_id);
            if (auto && auto.id !== m.id) {
              m.related_action = auto;
              groupedIds.add(auto.id!);
            }
          } 
          // If it's an Auto that points back to a Fijacion Estado (redundant check but safe)
          else if (m.fijacion_action_id) {
              const fijacion = movementMap.get(m.fijacion_action_id);
              if (fijacion && fijacion.id !== m.id) {
                  // If we find the fijacion, we prefer to group under the fijacion
                  // So we skip this auto if it hasn't been grouped yet (it will be grouped when we process the fijacion)
                  // But wait, what if the fijacion is NOT in this list? 
                  // If the fijacion IS in this list, it will eventually process it and group this auto.
                  // If the fijacion is NOT in this list, we keep the auto as is.
                  
                  // Optimization: If fijacion is in list, we'll handle it there.
                  if (rawMovements.find(rm => rm.id === fijacion!.id || rm.process_action_id === m.fijacion_action_id)) {
                      // We'll let the Fijacion handle the grouping.
                      // But we don't know if the Fijacion has already been processed or will be.
                      // So we just check if it's already in groupedIds.
                  }
              }
          }

          finalMovements.push(m);
        });

        // Filter out the ones that were grouped into another row
        const allMovements = finalMovements.filter(m => !groupedIds.has(m.id!));
        
        this.movements.set(allMovements);
        
        // Normalizamos la paginación
        const totalMovements = allMovements.length;
        const perPage = response.per_page || 10;
        const lastPage = Math.ceil(totalMovements / perPage);
        const currentPage = response.current_page;
        
        this.pagination.set({
          current_page: currentPage,
          per_page: perPage,
          total: totalMovements,
          last_page: lastPage > 0 ? lastPage : 1,
          from: (currentPage - 1) * perPage + 1,
          to: Math.min(currentPage * perPage, totalMovements),
        });
        this.loading.set(false);
      },
      error: (error) => {
        console.error('Error loading movements:', error);
        this.loading.set(false);
      },
    });
  }

  /**
   * Update query params
   */
  private _updateQueryParams(filters: NotificationDigestFilter): void {
    const queryParams: any = {};
    if (filters.process_number) queryParams.process_number = filters.process_number;
    if (filters.registration_date_from) queryParams.registration_date_from = filters.registration_date_from;
    if (filters.registration_date_to) queryParams.registration_date_to = filters.registration_date_to;
    if (filters.term_start_date_from) queryParams.term_start_date_from = filters.term_start_date_from;
    if (filters.term_start_date_to) queryParams.term_start_date_to = filters.term_start_date_to;
    if (filters.term_end_date_from) queryParams.term_end_date_from = filters.term_end_date_from;
    if (filters.term_end_date_to) queryParams.term_end_date_to = filters.term_end_date_to;
    if (filters.page && filters.page > 1) queryParams.page = filters.page;
    if (filters.per_page && filters.per_page !== 10) queryParams.per_page = filters.per_page;

    this._router.navigate([], {
      relativeTo: this._activatedRoute,
      queryParams,
      replaceUrl: true,
    });
  }

  /**
   * Handle Search
   */
  onSearch(): void {
    this.loadMovements(1, this.pagination()?.per_page || 10);
  }

  /**
   * Handle Reset
   */
  onResetFilters(): void {
    this.filterForm.reset();
    this.loadMovements(1, this.pagination()?.per_page || 10);
  }

  /**
   * Handle Page Change
   */
  onPageChange(event: { page: number; perPage: number }): void {
    // Si ya tenemos todos los datos en local (e.g. 151 resultados en 1 sola página)
    // actualizamos la paginación local para que el computed 'pagedMovements' haga su magia.
    const currentPagination = this.pagination();
    if (currentPagination && this.movements().length > 10) {
       this.pagination.update(prev => {
         if (!prev) return null;
         const total = this.movements().length;
         const lastPage = Math.ceil(total / event.perPage);
         return {
           ...prev,
           current_page: event.page,
           per_page: event.perPage,
           last_page: lastPage,
           from: (event.page - 1) * event.perPage + 1,
           to: Math.min(event.page * event.perPage, total)
         };
       });
       
       // Sincronizamos la URL
       this._updateQueryParams({
         page: event.page,
         per_page: event.perPage
       });
       return;
    }

    this.loadMovements(event.page, event.perPage);
  }

  /**
   * Handle Row Click (emission from data table)
   */
  onRowClick(row: Movement): void {
    // Single click can be used for selection if needed
  }

  /**
   * Handle Row Double Click (Navigate to detail)
   */
  onRowDblClick(row: Movement): void {
    if (row.process_id) {
       this._router.navigate(['/gestion-procesos', row.process_id]);
    } else if (row.id) {
       // Fallback for some APIs that might use id as process_id in this context
       this._router.navigate(['/gestion-procesos', row.id]);
    }
  }

  /**
   * Navigate to process detail
   */
  goToDetail(processNumber: string): void {
     // I need to find the internal ID of the process to navigate. 
     // Usually, it's /gestion-procesos/:id. 
     // The movement has process_number. 
     // The user says "doble click en la fila" to see detail. 
     // If the API doesn't provide the process ID, I might have to find it or the backend might need to provide it.
     // In the example JSON, I don't see "process_id", only "process_number".
     // I'll check if I can navigate by process_number or if I should assume the ID is present but not in the sample.
  }

  /**
   * Help to render alert level dot with tooltip
   */
  private _renderAlertCell(row: Movement, index?: number): string {
    const isFirstRows = index !== undefined && index < 2;

    // Si no hay nivel de alerta ni rol de abogado, mostramos un pequeño recordatorio/CTA
    if (!row.alert_level) {
      if (!row.lawyer_role) {
        return `
          <div class="flex justify-center items-center h-full w-full">
            <span class="process-list-tooltip tooltip-left-aligned ${isFirstRows ? 'tooltip-bottom' : ''} cursor-pointer group/vincular">
              <div class="tooltip-content text-left text-sm max-w-xs rounded-xl shadow-2xl bg-white border border-base-200 p-4 space-y-2 z-[1000]">
                <div class="flex items-center gap-2">
                   <svg xmlns="http://www.w3.org/2000/svg" class="h-3 w-3 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                   </svg>
                   <span class="font-extrabold text-[10px] uppercase text-base-content/40 tracking-wider">Activar alertas</span>
                </div>
                <p class="text-base-content leading-relaxed font-bold text-[12px]">
                  Para activar el semáforo de actividad, debe vincular su rol (Demandante o Demandado) desde las <b>acciones del proceso</b> o de forma <b>masiva</b>.
                </p>
              </div>
              <div class="flex flex-col items-center gap-1 opacity-50 group-hover/vincular:opacity-100 transition-opacity">
                 <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-base-content/40 group-hover/vincular:text-primary transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                 </svg>
                 <span class="text-[8px] uppercase font-black tracking-widest text-base-content/60 text-center leading-none">
                   Vincular rol
                 </span>
              </div>
            </span>
          </div>
        `;
      } else {
        // Estado de Escucha (Rol vinculado pero sin alerta aún)
        const roleText = row.lawyer_role.toLowerCase();
        const threshold = roleText.includes('demandado') || roleText.includes('defendant') ? '+90 días' : '+45 días';
        
        return `
          <div class="flex justify-center items-center h-full w-full">
            <span class="process-list-tooltip tooltip-left-aligned ${isFirstRows ? 'tooltip-bottom' : ''} cursor-help group/escucha">
              <div class="tooltip-content text-left text-sm max-w-xs rounded-xl shadow-2xl bg-white border border-base-200 p-4 z-[1000]">
                 <p class="text-[11px] font-bold text-base-content leading-tight">
                   Esperando actividad (${threshold})
                 </p>
              </div>
              <div class="flex flex-col items-center gap-1.5 opacity-40 group-hover/escucha:opacity-100 transition-opacity">
                <div class="w-3.5 h-3.5 rounded-full bg-base-300 ring-2 ring-base-200 shadow-inner"></div>
                <span class="text-[9px] font-bold uppercase tracking-tight text-base-content/40">En espera</span>
              </div>
            </span>
          </div>
        `;
      }
    }

    const level = row.alert_level;
    const role = row.lawyer_role;
    
    let tooltipKey = '';
    
    if (level === 'red') {
      tooltipKey = role === 'Demandante' ? 'redDemandante' : 'redGeneral';
    } else if (level === 'yellow') {
      tooltipKey = role === 'Demandante' ? 'yellowDemandante' : 'yellowGeneral';
    } else {
      tooltipKey = role === 'Demandado' ? 'greenDemandado' : (role === 'Demandante' ? 'greenDemandante' : 'greenGeneral');
    }
    
    const message = this._transloco.translate(`actuacionesRecientes.table.alerts.${tooltipKey}`);
    
    return `
      <div class="flex justify-center items-center h-full w-full">
        <span class="process-list-tooltip tooltip-left-aligned ${isFirstRows ? 'tooltip-bottom' : ''} cursor-pointer">
          <div class="tooltip-content text-left text-sm max-w-xs rounded-xl shadow-2xl bg-white border border-base-200 p-4 space-y-2 z-[1000]">
            <div class="flex items-center gap-2 mb-1">
               <div class="w-3 h-3 rounded-full alert-dot alert-${level}"></div>
               <span class="font-extrabold text-[10px] uppercase text-base-content/40 tracking-wider">
                 ${this._transloco.translate('actuacionesRecientes.table.alertLevel')}
               </span>
            </div>
            <p class="text-base-content leading-relaxed font-bold text-[13px]">
              ${message}
            </p>
            ${role ? `<div class="mt-2 pt-2 border-t border-base-100 text-[10px] text-base-content/30 uppercase font-black tracking-tight">Rol del abogado: ${role}</div>` : ''}
          </div>
          <div class="alert-dot alert-${level} ${level === 'red' ? 'alert-pulse' : ''} shadow-sm border border-black/5"></div>
        </span>
      </div>
    `;
  }

  /**
   * Help to render party cell with tooltip
   */
  private _renderPartyCell(value: string[] | null | undefined): string {
    const names = Array.isArray(value) ? value : [];
    if (names.length === 0) return '<span class="text-base-content/50">–</span>';
    
    const mainText = names[0];
    const extraCount = names.length - 1;
    
    if (extraCount > 0) {
      const listItems = names.map((name, i) => `<div class="text-base-content">${i + 1}. ${name}</div>`).join('');
      
      return `
        <span class="flex items-center gap-1">
          <span class="truncate max-w-[150px] title="${mainText}">${mainText}</span>
          <span class="process-list-tooltip" onclick="event.stopPropagation()">
            <div class="tooltip-content text-left text-sm max-w-xs rounded-lg shadow-lg bg-base-100 border border-base-300 p-3 space-y-1">
              ${listItems}
            </div>
            <span class="text-primary font-bold cursor-pointer whitespace-nowrap underline decoration-primary/50 decoration-dotted underline-offset-1">
              (+${extraCount})
            </span>
          </span>
        </span>
      `;
    }
    
    return `<span class="truncate max-w-[180px] block" title="${mainText}">${mainText}</span>`;
  }

  /**
   * Render action cell with highlights and annotation
   */
  public renderActionCell(row: Movement, index?: number): string {
    const show = this.showHighlights();
    const related = row.related_action;
    
    // Main action text (Fijación)
    const actionHtml = show 
      ? buildTextWithHighlights(row.action_text, row.alert_highlights, 'action_text')
      : row.action_text;
      
    // Annotation (prefer Auto's annotation if available and not empty, otherwise Fijación's)
    let annotationToUse = row.annotation;
    let highlightsToUse = row.alert_highlights;
    
    if (related && related.annotation && related.annotation !== '---' && related.annotation !== '–') {
        annotationToUse = related.annotation;
        highlightsToUse = related.alert_highlights;
    }
      
    let html = `<div class="flex flex-col gap-1.5 py-1">`;
    
    if (related) {
        const relatedActionHtml = show 
          ? buildTextWithHighlights(related.action_text, related.alert_highlights, 'action_text')
          : related.action_text;
          
        html += `
          <div class="flex flex-col gap-1">
            <div class="flex items-center gap-1.5">
               <span class="badge badge-sm bg-primary/10 text-primary border-none font-bold text-[8px] px-1 h-3.5 uppercase tracking-tighter shrink-0">Fijación</span>
               <div class="font-bold text-base-content/80 leading-tight text-[11px] truncate">${actionHtml}</div>
            </div>
            <div class="flex items-center gap-1.5">
               <span class="badge badge-sm bg-accent/10 text-accent border-none font-bold text-[8px] px-1 h-3.5 uppercase tracking-tighter shrink-0">Auto</span>
               <div class="font-bold text-base-content leading-tight text-[12px] truncate max-w-[180px]">
                 ${relatedActionHtml}
               </div>
            </div>
          </div>
        `;
    } else {
        html += `
          <div class="flex flex-col gap-0.5">
            <div class="font-bold text-base-content/90 leading-snug truncate">${actionHtml}</div>
          </div>
        `;
    }
    
    html += `</div>`;
    
    return html;
  }

  /**
   * Toggle highlights
   */
  public toggleHighlights(): void {
    this.showHighlights.update(v => !v);
  }

  /**
   * Toggle filter visibility
   */
  public toggleFilters(): void {
    this.showFilters.update(v => !v);
  }

  /**
   * Calculate page numbers to display in pagination controls
   */
  getPageNumbers(): number[] {
    const pagination = this.pagination();
    if (!pagination) return [];

    const current = pagination.current_page;
    const last = pagination.last_page;
    const pages: number[] = [];

    // Show up to 5 pages around the current page
    let start = Math.max(1, current - 2);
    let end = Math.min(last, start + 4);

    if (end - start < 4) {
      start = Math.max(1, end - 4);
    }

    for (let i = start; i <= end; i++) {
      pages.push(i);
    }

    return pages;
  }

  /**
   * Copy text to clipboard
   */
  copyToClipboard(text: string, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    navigator.clipboard.writeText(text).then(() => {
      this.copiedMessage.set('Radicado copiado!');
      setTimeout(() => this.copiedMessage.set(null), 3000);
    });
  }

  /**
   * Abre la modal de leyenda (mismo contenido que el tooltip de escritorio)
   */
  public openLegendModal(event?: MouseEvent): void {
    if (event) {
      event.stopPropagation();
    }
    this.showLegendModal.set(true);
  }

  /**
   * Cierra la modal de leyenda
   */
  public closeLegendModal(): void {
    this.showLegendModal.set(false);
  }

  /**
   * Abre la modal de detalle del movimiento
   */
  public openMovementModal(row: Movement, event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.selectedMovement.set(row);
    this.showMovementModal.set(true);
  }

  /**
   * Cierra la modal de detalle del movimiento
   */
  public closeMovementModal(): void {
    this.showMovementModal.set(false);
    this.selectedMovement.set(null);
  }

  /**
   * Helper for template to build highlighted text
   */
  public getHighlightedText(text: string | null | undefined, highlights: any[] | null | undefined, source: string): string {
    if (!text) return '';
    if (!highlights || highlights.length === 0 || !this.showHighlights()) return text;
    return buildTextWithHighlights(text, highlights, source);
  }
}
