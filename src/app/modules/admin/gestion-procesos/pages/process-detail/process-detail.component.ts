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
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { AuthenticatedLayoutComponent } from '@app/layout/layouts/authenticated/authenticated.component';
import { FormBuilder, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { ProcessNumberPipe } from '@app/shared/pipes/process-number.pipe';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ProcessService } from '@app/core/services/process/process.service';
import {
  ProcessDetail,
  ProcessDetailInstance,
  Subject,
  Action,
  ActionDocument,
  ActionFilter,
  ActionResponse,
  ActionResponseMeta,
  AlertKeyword,
  AlertKeywordStat,
  ProcessActionDocument,
  TrashProcessesResponse,
} from '@app/core/models/process/process.model';
import { buildTextWithHighlights } from '@app/core/utils/alert-highlight.utils';
import { DateRangePickerComponent, DateRange } from '@app/shared/components/date-range-picker/date-range-picker.component';
import { DataTableComponent, DataTableColumn } from '@app/shared/components/data-table/data-table.component';
import { ConfirmationDialogComponent } from '@app/shared/components/confirmation-dialog/confirmation-dialog.component';
import { ProcessAlertTooltipComponent } from '@app/shared/components/process-alert-tooltip/process-alert-tooltip.component';
import { RoleSelectionModalComponent } from '../../components/role-selection-modal/role-selection-modal.component';
import { ProcessAiChatComponent } from '../../components/process-ai-chat/process-ai-chat.component';
import { ProcessTasksDrawerComponent } from '../../components/process-tasks-drawer/process-tasks-drawer.component';
import { ProcessTimelineComponent } from '../../components/process-timeline/process-timeline.component';
import { ProcessManualSyncBadgeComponent } from '@app/shared/components/process-manual-sync-badge/process-manual-sync-badge.component';
import { ActionDocumentsViewerComponent } from '@app/shared/components/action-documents-viewer/action-documents-viewer.component';
import { AiCoreService } from '@app/core/services/ai-chat/ai-core.service';
import { PageHeaderContextService } from '@app/core/services/layout/page-header-context.service';
import { ProcessRefreshService } from '@app/core/services/process/process-refresh.service';
import { ProcessQuotaService } from '@app/core/services/process/process-quota.service';
import { NotificationService } from '@app/core/services/notification/notification.service';
import { getSemaphorePauseMessage, isSemaphorePaused } from '@app/core/utils/process-semaphore.util';

const DETAIL_HEADER_SCROLL_THRESHOLD = 80;

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
    RoleSelectionModalComponent,
    ProcessAiChatComponent,
    ProcessTasksDrawerComponent,
    ProcessTimelineComponent,
    ProcessManualSyncBadgeComponent,
    ActionDocumentsViewerComponent,
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
  private _layout = inject(AuthenticatedLayoutComponent, { optional: true });
  private _aiCoreService = inject(AiCoreService);
  private _headerContext = inject(PageHeaderContextService);
  private _processRefresh = inject(ProcessRefreshService);
  private _quotaService = inject(ProcessQuotaService);
  private _notificationService = inject(NotificationService);
  private _transloco = inject(TranslocoService);

  // AI Permission State
  public isAiEnabled = this._aiCoreService.isAiEnabled;

  // State
  public process = signal<ProcessDetail | null>(null);
  public showProcessTasksDrawer = signal(false);
  public processInstances = signal<ProcessDetailInstance[]>([]);
  public loadingInstances = signal<boolean>(false);
  public subjects = signal<Subject[]>([]);
  public plaintiffSubjects = computed(() =>
    this.subjects().filter((s) => this.isPlaintiffSubject(s))
  );
  public defendantSubjects = computed(() =>
    this.subjects().filter((s) => this.isDefendantSubject(s))
  );
  /** Sujetos cuyo tipo no es demandante ni demandado (p. ej. Opositor, Recurrente casación) */
  public otherSubjects = computed(() =>
    this.subjects().filter((s) => !this.isPlaintiffSubject(s) && !this.isDefendantSubject(s))
  );
  /** Layout de dos columnas solo cuando hay al menos un demandante o demandado */
  public hasClassicSubjectLayout = computed(
    () => this.plaintiffSubjects().length > 0 || this.defendantSubjects().length > 0
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

  /** Eliminar proceso (mismo endpoint que gestión) */
  public deleteConfirmOpen = signal(false);
  public deletingProcess = signal(false);

  /** Estado del mensaje de copiado (idéntico a Actuaciones Recientes) */
  public copiedMessage = signal<string | null>(null);
  /** Estado del toast (para otros mensajes) */
  public toastVisible = signal<boolean>(false);
  public toastType = signal<'success' | 'error'>('success');
  public toastMessage = signal<string>('');

  /** Row id highlighted from ?actionId= deep link */
  public highlightedActionId = signal<string | null>(null);
  /** Media id highlighted from ?mediaId= (notification / email deep link) */
  public highlightedMediaId = signal<number | null>(null);
  /** Modal listado + visor de documentos de una actuación */
  public showActionDocumentsModal = signal(false);
  public actionDocumentsModalDocs = signal<ActionDocument[]>([]);
  public actionDocumentsModalLabel = signal<string | null>(null);
  public actionDocumentsAutoOpenFirst = signal(false);

  /** Historial de documentos del proceso (acordeón) */
  public processDocuments = signal<ProcessActionDocument[]>([]);
  public loadingProcessDocuments = signal(false);
  public processDocumentsError = signal<string | null>(null);
  public processDocumentsPage = signal(1);
  public processDocumentsLastPage = signal(1);
  public processDocumentsTotal = signal(0);
  public loadingMoreProcessDocuments = signal(false);

  /** Modal de asignación de rol */
  public showRoleModal = signal<boolean>(false);

  /** Selector de instancia en móvil */
  public showInstanceSelector = signal<boolean>(false);

  /** Estado del chat de IA */
  public showAiChat = signal<boolean>(false);
  public isChatPinned = signal<boolean>(false);

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

  /** Pending deep-link action id from ?actionId= */
  private _pendingActionId: string | null = null;
  private _pendingSection: string | null = null;
  private _pendingMediaId: number | null = null;
  private _pendingFilename: string | null = null;
  private _pendingMediaOpened = false;
  /** Last query deep-link key already handled (avoids re-scan on queryParam re-emits) */
  private _handledQueryKey: string | null = null;
  private _actionDeepLinkSearchDepth = 0;
  private static readonly _MAX_ACTION_DEEP_LINK_PAGES = 50;
  private static readonly _PROCESS_DOCS_PER_PAGE = 12;

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
        render: (value: string | null, row: Action) => {
          const mainAction = row.action ?? value;
          const related = row.related_action;
          
          const actionHtml = buildTextWithHighlights(mainAction, row.alert_highlights, 'action');
          
          if (related) {
            const relatedActionHtml = buildTextWithHighlights(related.action ?? '', related.alert_highlights, 'action');
            const lowerAction = mainAction?.toLowerCase() || '';
            const badgeLabel = lowerAction.includes('notificacion') || lowerAction.includes('notificación') ? 'Notificación' : 'Fijación';
            
            return `
              <div class="flex flex-col gap-1">
                <div class="flex items-center gap-1.5">
                   <span class="badge badge-sm bg-primary/10 text-primary border-none font-bold text-[9px] px-1.5 h-4 uppercase tracking-tighter">${badgeLabel}</span>
                   <div class="font-bold text-base-content leading-tight">${actionHtml}</div>
                </div>
                <div class="flex items-center gap-1.5">
                   <span class="badge badge-sm bg-accent/10 text-accent border-none font-bold text-[9px] px-1.5 h-4 uppercase tracking-tighter">Auto</span>
                   <div class="font-bold text-base-content leading-tight">${relatedActionHtml}</div>
                </div>
              </div>
            `;
          }
          return actionHtml;
        },
      },
      {
        key: 'annotation',
        label: 'processDetail.actions.table.annotation',
        html: true,
        render: (value: string | null, row: Action) => {
          const related = row.related_action;
          let annotationToUse = row.annotation ?? value;
          let highlightsToUse = row.alert_highlights;

          if (related && related.annotation && related.annotation !== '---' && related.annotation !== '–') {
            annotationToUse = related.annotation;
            highlightsToUse = related.alert_highlights;
          }

          if (!annotationToUse || annotationToUse === '---' || annotationToUse === '–') return '–';
          
          return buildTextWithHighlights(annotationToUse, highlightsToUse, 'annotation');
        },
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
      {
        key: 'documents',
        label: 'processDetail.actions.table.documents',
        width: '140px',
        align: 'center',
        html: true,
        render: (_value: unknown, row: Action) => this.renderActionDocumentsCell(row),
      },
    ];

    this._route.paramMap
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((params) => {
        this._headerContext.setCompactVisible(false);
        const id = params.get('id');
        this.highlightedActionId.set(null);
        this.highlightedMediaId.set(null);
        this._handledQueryKey = null;
        this._pendingMediaOpened = false;
        this.captureDeepLinkFromQuery(this._route.snapshot.queryParamMap);
        this._actionDeepLinkSearchDepth = 0;
        this.resetProcessDocumentsState();
        this.loadProcessDetail(id);
        // Avoid fighting deep-link scroll to documents section
        if (this._pendingSection !== 'documents' && this._pendingMediaId == null) {
          queueMicrotask(() => {
            document.querySelector<HTMLElement>('.process-detail-scroll')?.scrollTo(0, 0);
          });
        }
      });

    this._route.queryParamMap
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((params) => {
        const key = this.buildDeepLinkKey(params);
        if (key === this._handledQueryKey) {
          return;
        }
        this._handledQueryKey = key;
        this._pendingMediaOpened = false;
        this.captureDeepLinkFromQuery(params);
        this.highlightedActionId.set(null);
        this.highlightedMediaId.set(this._pendingMediaId);
        if (this.process()) {
          this.applyDeepLink();
        }
      });

    this._processRefresh.refreshed$
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe((processId) => {
        if (this.process()?.id === processId) {
          this.refreshProcessStatus(processId);
        }
      });

    // New actuaciones / action-documents via WebSocket → reload history + actions
    this._notificationService.refreshProcesses$
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe(() => {
        if (!this.process()) return;
        this.loadActions();
        this.loadProcessDocuments(1);
      });

    // Validar estado de IA para la organización
    this._aiCoreService.checkAiStatus().subscribe();

    // Load alert keywords, stats, actions and document history when process is loaded
    effect(() => {
      const process = this.process();
      if (process) {
        this.loadAlertKeywords(process.id);
        this.loadAlertKeywordStats(process.id);
        this.loadActions();
        this.loadProcessDocuments(1);
        queueMicrotask(() => this.applyDeepLink());
      }
    });

    effect(() => {
      const process = this.process();
      const instance = this.selectedInstance();

      if (!process) {
        this._headerContext.setProcessDetailContext(null);
        return;
      }

      const statusLabel = this.initialStatusLabel() || process.status_label;
      const lastActivitySource =
        process.has_multiple_instances && instance
          ? instance.last_activity_date
          : process.last_activity_date;
      const lawyerRole = instance?.lawyer_role ?? process.lawyer_role;

      this._headerContext.setProcessDetailContext({
        processNumber: process.process_number,
        statusLabel,
        statusBadgeClass: this.getStatusClass(statusLabel),
        alertLevel: process.alert_level ?? null,
        semaphorePaused: isSemaphorePaused(process.semaphore),
        semaphoreMessage: getSemaphorePauseMessage(process.semaphore),
        lawyerRole: lawyerRole ?? null,
        lawyerRoleLabel: lawyerRole ? this.getRoleLabel(lawyerRole) : null,
        instanceName: process.has_multiple_instances ? (instance?.court ?? null) : null,
        lastActivityDate: this.formatDateSafe(lastActivitySource, 'shortDate'),
        isManualSync: instance?.is_manual_sync ?? process.is_manual_sync ?? false,
      });
    });

    this._destroyRef.onDestroy(() => {
      this._headerContext.clearProcessDetail();
    });
  }

  /**
   * Sync compact header visibility from detail scroll (desktop only)
   */
  onDetailScroll(event: Event): void {
    if (typeof window !== 'undefined' && window.innerWidth < 768) {
      return;
    }
    const target = event.target as HTMLElement;
    this._headerContext.setCompactVisible(target.scrollTop > DETAIL_HEADER_SCROLL_THRESHOLD);
  }

  /**
   * Abre la modal de asignación de rol
   */
  public openRoleModal(): void {
    this.showRoleModal.set(true);
  }

  /**
   * Cierra la modal de asignación de rol
   */
  public closeRoleModal(): void {
    this.showRoleModal.set(false);
  }

  /**
   * Maneja el evento de guardado del rol
   * @param role - Nuevo rol guardado
   */
  public onRoleSaved(role: string): void {
    this.closeRoleModal();
    const processId = this.process()?.id;
    if (processId) {
      this.loadProcessDetail(processId);
    }
    // Mostrar mensaje de éxito
    this.showToast('success', 'Rol del abogado actualizado exitosamente.');
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
   * Alterna la visibilidad del chat de IA
   */
  public toggleAiChat(): void {
    const newState = !this.showAiChat();
    this.showAiChat.set(newState);

    // automatically close global sidebar when opening chat
    if (newState && this._layout) {
      this._layout.closeSidebar();
    }

    // if closing chat, unpin it
    if (!newState) this.isChatPinned.set(false);
  }

  public openProcessTasksDrawer(): void {
    this.showProcessTasksDrawer.set(true);
  }

  public closeProcessTasksDrawer(): void {
    this.showProcessTasksDrawer.set(false);
  }

  public onProcessTasksCountChange(count: number): void {
    const current = this.process();
    if (!current) return;
    this.process.set({ ...current, tasks_count: count });
  }

  public onProcessReactivatedFromTasks(): void {
    const id = this.process()?.id;
    if (id) {
      this.refreshProcessStatus(id);
    }
  }

  /**
   * Soft-refresh process header/status without wiping the rest of the detail view.
   */
  public refreshProcessStatus(id: string): void {
    this._processService.getProcessDetail(id).subscribe({
      next: (response) => {
        this.process.update((current) =>
          current ? { ...current, ...response.process } : response.process
        );
        this.initialStatusLabel.set(response.process.status_label);
      },
      error: (error) => {
        console.error('Error refreshing process detail:', error);
      },
    });
  }

  public onChatPinnedChanged(pinned: boolean): void {
    this.isChatPinned.set(pinned);
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
        const rawActions = response.data;
        const actionMap = new Map<string, Action>();
        rawActions.forEach(a => actionMap.set(a.id, a));

        const finalActions: Action[] = [];
        const groupedIds = new Set<string>();

        rawActions.forEach(a => {
          if (groupedIds.has(a.id)) return;

          // If it's a notification (Fijacion, Notificacion por estado, etc.) that points to an Auto
          const actionText = a.action?.toLowerCase() || '';
          const isNotification = actionText.includes('fijacion') || 
                                actionText.includes('notificacion') || 
                                actionText.includes('notificación') || 
                                actionText.includes('estado');

          if (isNotification && a.notified_action_id) {
            const auto = actionMap.get(a.notified_action_id);
            if (auto && auto.id !== a.id) {
              a.related_action = auto;
              groupedIds.add(auto.id);
            }
          }
          finalActions.push(a);
        });

        const filteredActions = finalActions.filter(a => !groupedIds.has(a.id));

        this.actions.set(filteredActions);
        this.actionsPagination.set({
          current_page: response.current_page,
          per_page: response.per_page,
          total: response.total - groupedIds.size, // Adjust total count since we grouped some
          last_page: Math.ceil((response.total - groupedIds.size) / response.per_page),
          from: response.from,
          to: Math.min(response.to, response.total - groupedIds.size),
        });
        this.loadingActions.set(false);
        this.tryFocusPendingAction(response);
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
   * Documents visible for a row (own + related auto when grouped).
   */
  public getActionDocuments(action: Action): ActionDocument[] {
    const own = action.documents ?? [];
    const related = action.related_action?.documents ?? [];
    if (!related.length) return own;
    const seen = new Set(own.map((d) => d.id));
    return [...own, ...related.filter((d) => !seen.has(d.id))];
  }

  public hasActionDocuments(action: Action): boolean {
    return this.getActionDocuments(action).length > 0;
  }

  /**
   * Event delegation for "Ver documentos" buttons rendered inside data-table HTML cells.
   */
  public onActionDocumentsClick(event: MouseEvent): void {
    const target = (event.target as HTMLElement | null)?.closest(
      '[data-open-action-docs]'
    ) as HTMLElement | null;
    if (!target) return;
    event.preventDefault();
    event.stopPropagation();
    const actionId = target.dataset['openActionDocs'];
    if (!actionId) return;
    const action = this.actions().find((a) => a.id === actionId);
    if (action) {
      this.openActionDocumentsModal(action);
    }
  }

  public openActionDocumentsModal(action: Action): void {
    const docs = this.getActionDocuments(action);
    if (!docs.length) return;
    this.actionDocumentsModalDocs.set(docs);
    this.actionDocumentsModalLabel.set(action.action ?? null);
    this.actionDocumentsAutoOpenFirst.set(docs.length === 1);
    this.showActionDocumentsModal.set(true);
  }

  public closeActionDocumentsModal(): void {
    this.showActionDocumentsModal.set(false);
    this.actionDocumentsModalDocs.set([]);
    this.actionDocumentsModalLabel.set(null);
    this.actionDocumentsAutoOpenFirst.set(false);
  }

  public onActionDocumentsViewerError(message: string): void {
    this.showToast('error', message);
  }

  public openProcessDocument(doc: ProcessActionDocument): void {
    this.actionDocumentsModalDocs.set([
      {
        id: doc.id,
        original_filename: doc.original_filename,
        size_bytes: doc.size_bytes,
        mime_type: doc.mime_type,
      },
    ]);
    this.actionDocumentsModalLabel.set(doc.action ?? null);
    this.actionDocumentsAutoOpenFirst.set(true);
    this.showActionDocumentsModal.set(true);
  }

  public loadProcessDocuments(page: number = 1): void {
    const process = this.process();
    if (!process) return;

    const isFirstPage = page <= 1;
    if (isFirstPage) {
      this.loadingProcessDocuments.set(true);
      this.processDocumentsError.set(null);
    } else {
      this.loadingMoreProcessDocuments.set(true);
    }

    this._processService
      .getProcessActionDocuments(process.id, {
        page,
        per_page: ProcessDetailComponent._PROCESS_DOCS_PER_PAGE,
      })
      .subscribe({
        next: (response) => {
          const rows = response.data ?? [];
          const meta = response.meta;
          const currentPage = meta?.current_page ?? response.current_page ?? page;
          const lastPage = meta?.last_page ?? response.last_page ?? 1;
          const total = meta?.total ?? response.total ?? rows.length;

          this.processDocuments.set(isFirstPage ? rows : [...this.processDocuments(), ...rows]);
          this.processDocumentsPage.set(currentPage);
          this.processDocumentsLastPage.set(lastPage);
          this.processDocumentsTotal.set(total);
          this.loadingProcessDocuments.set(false);
          this.loadingMoreProcessDocuments.set(false);

          if (this._pendingMediaId != null || this.highlightedMediaId() != null) {
            this.tryOpenPendingMedia();
            // History cards are in the DOM now — re-open accordion and scroll to the file
            if (this._pendingSection === 'documents' || this.highlightedMediaId() != null) {
              this.openDocumentsAccordion(true);
            }
          }
        },
        error: () => {
          this.loadingProcessDocuments.set(false);
          this.loadingMoreProcessDocuments.set(false);
          if (isFirstPage) {
            this.processDocuments.set([]);
            this.processDocumentsTotal.set(0);
          }
          this.processDocumentsError.set(
            this._transloco.translate('processDetail.documentsHistory.loadError')
          );
        },
      });
  }

  public loadMoreProcessDocuments(): void {
    if (
      this.loadingMoreProcessDocuments() ||
      this.loadingProcessDocuments() ||
      this.processDocumentsPage() >= this.processDocumentsLastPage()
    ) {
      return;
    }
    this.loadProcessDocuments(this.processDocumentsPage() + 1);
  }

  public hasMoreProcessDocuments(): boolean {
    return this.processDocumentsPage() < this.processDocumentsLastPage();
  }

  /** Backend already localizes created_at (formatDateTimeWithDayOfWeek). */
  public documentUploadedAt(doc: ProcessActionDocument): string {
    return (doc.uploaded_at || doc.created_at || '').trim();
  }

  /** Backend already localizes action_date (formatDateWithDayOfWeek). */
  public documentActionDate(doc: ProcessActionDocument): string {
    return (doc.action_date || '').trim();
  }

  public formatDocumentSize(bytes: number | null | undefined): string {
    if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  private resetProcessDocumentsState(): void {
    this.processDocuments.set([]);
    this.processDocumentsError.set(null);
    this.processDocumentsPage.set(1);
    this.processDocumentsLastPage.set(1);
    this.processDocumentsTotal.set(0);
    this.loadingProcessDocuments.set(false);
    this.loadingMoreProcessDocuments.set(false);
  }

  private buildDeepLinkKey(params: ParamMap): string {
    return [
      params.get('actionId') ?? '',
      params.get('section') ?? '',
      params.get('mediaId') ?? '',
      params.get('filename') ?? '',
    ].join('|');
  }

  private captureDeepLinkFromQuery(params: ParamMap): void {
    this._pendingActionId = params.get('actionId');
    this._pendingSection = params.get('section');
    const mediaRaw = params.get('mediaId');
    const mediaId = mediaRaw != null ? Number(mediaRaw) : NaN;
    this._pendingMediaId = Number.isFinite(mediaId) && mediaId > 0 ? mediaId : null;
    this._pendingFilename = params.get('filename');
    this.highlightedMediaId.set(this._pendingMediaId);
    this._actionDeepLinkSearchDepth = 0;
  }

  private applyDeepLink(): void {
    if (this._pendingSection === 'documents' || this._pendingMediaId != null) {
      this.openDocumentsAccordion(true);
      if (this._pendingMediaId != null) {
        this.tryOpenPendingMedia();
      }
      // Prefer documents history for notification/email deep links; skip action modal
      this._pendingActionId = null;
      return;
    }

    if (this._pendingActionId && !this.loadingActions()) {
      this.tryFocusPendingAction();
    }
  }

  /**
   * Open the documents accordion and scroll to section / highlighted card.
   * Retries briefly because DaisyUI collapse + async history can race the first paint.
   */
  private openDocumentsAccordion(retry = false): void {
    const openOnce = (): boolean => {
      const input = document.getElementById(
        'process-documents-accordion'
      ) as HTMLInputElement | null;
      if (!input) return false;
      input.checked = true;
      const mediaId = this.highlightedMediaId();
      const target =
        (mediaId != null
          ? document.getElementById(`process-doc-card-${mediaId}`)
          : null) || document.getElementById('process-documents-section');
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return true;
    };

    queueMicrotask(() => {
      const ok = openOnce();
      if (!ok && retry) {
        setTimeout(() => openOnce(), 150);
        setTimeout(() => openOnce(), 400);
      }
    });
  }

  private tryOpenPendingMedia(): void {
    const mediaId = this._pendingMediaId;
    if (mediaId == null) {
      // Still scroll/highlight if we already opened the viewer earlier
      if (this.highlightedMediaId() != null) {
        this.openDocumentsAccordion(true);
      }
      return;
    }
    if (this._pendingMediaOpened) return;

    this.highlightedMediaId.set(mediaId);
    this.openDocumentsAccordion(true);

    const doc = this.processDocuments().find((d) => d.id === mediaId);
    if (doc) {
      this._pendingMediaOpened = true;
      this._pendingMediaId = null;
      this.openProcessDocument(doc);
      return;
    }

    // Open viewer immediately from deep-link data (don't wait for history pages)
    this._pendingMediaOpened = true;
    this._pendingMediaId = null;
    this.openProcessDocument({
      id: mediaId,
      original_filename: this._pendingFilename?.trim() || 'documento.pdf',
      size_bytes: 0,
      mime_type: 'application/pdf',
      action_id: this._pendingActionId,
    });
  }

  private renderActionDocumentsCell(row: Action): string {
    const docs = this.getActionDocuments(row);
    if (!docs.length) return '–';

    const label = this._transloco.translate('processDetail.actions.documents.openList');
    const countLabel =
      docs.length > 1
        ? this._transloco.translate('processDetail.actions.documents.count', {
            count: docs.length,
          })
        : '';
    const title = this.escapeHtmlAttr(
      countLabel ? `${label} (${docs.length})` : label
    );

    return `<button type="button" class="action-doc-btn btn btn-ghost btn-xs gap-1 h-auto min-h-0 py-1 px-2 text-primary font-bold normal-case"
      data-open-action-docs="${this.escapeHtmlAttr(row.id)}" title="${title}">
      <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2"
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <span>${this.escapeHtmlAttr(label)}</span>
      ${
        docs.length > 1
          ? `<span class="action-doc-btn__count badge badge-sm bg-primary text-white border-none font-bold">${docs.length}</span>`
          : ''
      }
    </button>`;
  }

  private escapeHtmlAttr(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  /**
   * Resolve ?actionId= against the loaded actions page (search further pages if needed).
   */
  private tryFocusPendingAction(response?: ActionResponse): void {
    const actionId = this._pendingActionId;
    if (!actionId) return;

    const match = this.actions().find(
      (a) => a.id === actionId || a.related_action?.id === actionId
    );

    if (match) {
      this._pendingActionId = null;
      this.highlightedActionId.set(match.id);
      queueMicrotask(() => {
        this.scrollToHighlightedAction();
        if (this.hasActionDocuments(match)) {
          this.openActionDocumentsModal(match);
        }
      });
      return;
    }

    // Query-param change while a page is already loaded: restart scan from page 1
    if (!response) {
      this._actionDeepLinkSearchDepth = 0;
      this.loadActions(1, this.actionsPagination()?.per_page || 10);
      return;
    }

    if (
      response.current_page < response.last_page &&
      this._actionDeepLinkSearchDepth < ProcessDetailComponent._MAX_ACTION_DEEP_LINK_PAGES
    ) {
      this._actionDeepLinkSearchDepth += 1;
      this.loadActions(response.current_page + 1, response.per_page);
      return;
    }

    this._pendingActionId = null;
    this.openActionsAccordion();
  }

  private openActionsAccordion(): void {
    const input = document.getElementById(
      'process-actions-accordion'
    ) as HTMLInputElement | null;
    if (input) {
      input.checked = true;
    }
  }

  private scrollToHighlightedAction(): void {
    this.openActionsAccordion();
    const section = document.getElementById('process-actions-section');
    section?.scrollIntoView({ behavior: 'smooth', block: 'start' });

    const rowId = this.highlightedActionId();
    if (!rowId) return;

    queueMicrotask(() => {
      const row =
        document.querySelector<HTMLElement>(`[data-row-id="${rowId}"]`) ||
        document.getElementById(`action-card-${rowId}`);
      row?.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
   * Check if process is inactive
   */
  isProcessInactive(): boolean {
    const status = this.initialStatusLabel() || this.process()?.status_label;
    const statusCode = this.process()?.status;
    if (statusCode === 'inactive') return true;
    if (statusCode === 'suspended' || statusCode === 'active') return false;
    if (!status) return false;
    const statusLower = status.toLowerCase();
    return statusLower.includes('inactivo') || statusLower.includes('inactive');
  }

  isProcessSuspended(): boolean {
    const process = this.process();
    if (!process) return false;
    if (process.status === 'suspended') return true;
    if (isSemaphorePaused(process.semaphore)) return true;
    const status = (this.initialStatusLabel() || process.status_label || '').toLowerCase();
    return status.includes('suspend');
  }

  isSemaphorePaused(): boolean {
    return isSemaphorePaused(this.process()?.semaphore);
  }

  getSemaphorePauseMessage(): string {
    return getSemaphorePauseMessage(
      this.process()?.semaphore,
      'Semáforo de inactividad en pausa. Debe completar o eliminar la tarea de suspensión en la Agenda para reactivarlo.'
    );
  }

  /**
   * Toggle process status (activate/deactivate)
   */
  toggleProcessStatus(): void {
    const process = this.process();
    if (!process) return;

    if (this.isProcessSuspended()) {
      this.showToast(
        'error',
        this.getSemaphorePauseMessage()
      );
      this.openProcessTasksDrawer();
      return;
    }

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
          status: isActivate ? 'active' : 'inactive',
          status_label: newStatus,
          semaphore: isActivate ? (process.semaphore ?? null) : process.semaphore,
        });
        this.confirmModalOpen.set(false);

        this._quotaService.loadQuota();

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
        this._quotaService.loadQuota();
        const apiMessage =
          (error.error?.messages && Array.isArray(error.error.messages)
            ? error.error.messages.join('. ')
            : null) ||
          error.error?.message ||
          'Error al cambiar el estado del proceso';
        this.showToast('error', apiMessage);
      }
    });
  }

  /**
   * Handle cancel from modal
   */
  onCancelStatusChange(): void {
    this.confirmModalOpen.set(false);
  }

  openDeleteConfirm(): void {
    if (this.deletingProcess() || !this.process()?.id) return;
    (document.activeElement as HTMLElement | null)?.blur?.();
    this.deleteConfirmOpen.set(true);
  }

  onCancelDelete(): void {
    if (this.deletingProcess()) return;
    this.deleteConfirmOpen.set(false);
  }

  onConfirmDelete(): void {
    if (this.deletingProcess()) return;
    const processId = this.process()?.id;
    if (!processId) return;

    this.deletingProcess.set(true);
    this._processService
      .deleteProcess(processId)
      .pipe(takeUntilDestroyed(this._destroyRef))
      .subscribe({
        next: (response) => this._onDeleteSuccess(response),
        error: (error) => this._onDeleteError(error),
      });
  }

  private _onDeleteSuccess(response: TrashProcessesResponse): void {
    this.deletingProcess.set(false);
    this.deleteConfirmOpen.set(false);

    if (response.quota) {
      this._quotaService.applyQuota(response.quota);
    } else {
      this._quotaService.loadQuota();
    }

    const count = response.trashed_count ?? 1;
    const key = count === 1 ? 'gestionProcesos.delete.success' : 'gestionProcesos.delete.successPlural';
    const successMessage =
      response.message ||
      this._transloco.translate(key, { count }) ||
      'Cupos actualizados.';

    this.showToast('success', successMessage);
    this._router.navigate(['/gestion-procesos']);
  }

  private _onDeleteError(error: { error?: { messages?: string[]; message?: string } }): void {
    this.deletingProcess.set(false);
    this.deleteConfirmOpen.set(false);
    const fallback =
      this._transloco.translate('gestionProcesos.delete.error') ||
      'No se pudo eliminar. Intente de nuevo.';
    const message =
      error?.error?.messages?.[0] || error?.error?.message || fallback;
    this.showToast('error', message);
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
   * Get status badge class - usa el estado inicial del proceso
   */
  getStatusClass(status: string): string {
    const statusLower = status.toLowerCase();

    if (statusLower.includes('suspend')) {
      return 'badge badge-info';
    }

    if (statusLower.includes('inactivo') || statusLower.includes('inactive')) {
      return 'badge badge-error';
    }

    if (statusLower.includes('activo') || statusLower.includes('active')) {
      return 'badge badge-success';
    }

    if (statusLower.includes('pendiente') || statusLower.includes('pending')) {
      return 'badge badge-warning';
    }

    if (statusLower.includes('cerrado') || statusLower.includes('closed')) {
      return 'badge badge-neutral';
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

  /**
   * Helper para mostrar el rol del abogado en mayúsculas y legible (Demandante/Demandado)
   */
  public getRoleLabel(role: string | null | undefined): string {
    if (!role) return '';
    const r = role.toLowerCase();
    if (this.isPlaintiffType(r)) return 'DEMANDANTE';
    if (this.isDefendantType(r)) return 'DEMANDADO';
    return role.toUpperCase();
  }

  public isPlaintiffSubject(subject: Subject): boolean {
    return this.isPlaintiffType(subject.subject_type?.toLowerCase() ?? '');
  }

  public isDefendantSubject(subject: Subject): boolean {
    return this.isDefendantType(subject.subject_type?.toLowerCase() ?? '');
  }

  private isPlaintiffType(type: string): boolean {
    return type === 'plaintiff' || type.includes('demandante');
  }

  private isDefendantType(type: string): boolean {
    return type === 'defendant' || type.includes('demandado');
  }
}
