import { ChangeDetectionStrategy, Component, inject, OnInit, signal, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { KeywordService, KeywordStatus } from '@app/core/services/keyword/keyword.service';
import { Keyword, KeywordPagination } from '@app/core/models/keyword/keyword.model';
import { KeywordCardComponent } from './components/keyword-card/keyword-card.component';
import { ConfirmationDialogComponent } from '@app/shared/components/confirmation-dialog/confirmation-dialog.component';
import { IconService } from '@app/core/services/icon/icon.service';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { finalize } from 'rxjs';

@Component({
    selector: 'app-keywords',
    standalone: true,
    imports: [CommonModule, TranslocoModule, KeywordCardComponent, FormsModule, ReactiveFormsModule, ConfirmationDialogComponent],
    templateUrl: './keywords.component.html',
    styleUrls: ['./keywords.component.scss'],
    encapsulation: ViewEncapsulation.None,
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KeywordsComponent implements OnInit {
    private _keywordService = inject(KeywordService);
    private _iconService = inject(IconService);
    private _fb = inject(FormBuilder);
    private _transloco = inject(TranslocoService);

    // State
    public keywords = signal<Keyword[]>([]);
    public isLoading = signal<boolean>(false);
    public isSaving = signal<boolean>(false);
    public currentPage = signal<number>(1);
    public totalPages = signal<number>(1);
    public hasMore = signal<boolean>(true);
    public statuses = signal<KeywordStatus[]>([]);

    // Filter State
    public filterForm: FormGroup;
    public showFilters = signal<boolean>(false);

    // Modal State
    public isModalOpen = signal<boolean>(false);
    public editingKeyword = signal<Keyword | null>(null);
    public keywordForm: FormGroup;

    // Feedback State
    public feedbackMessage = signal<string | null>(null);
    public feedbackType = signal<'success' | 'error'>('success');

    // Confirm Modal State
    public confirmModalOpen = signal<boolean>(false);
    public confirmModalTitle = signal<string>('');
    public confirmModalMessage = signal<string>('');
    public keywordToDelete = signal<Keyword | null>(null);

    constructor() {
        // Initialize Create/Edit Form
        this.keywordForm = this._fb.group({
            name: ['', [Validators.required, Validators.minLength(3)]],
            keyword: ['', [Validators.required]],
            status: ['active', [Validators.required]],
        });

        // Initialize Filter Form
        this.filterForm = this._fb.group({
            name: [''],
            keyword: [''],
            status: [''],
        });
    }

    ngOnInit(): void {
        this.loadStatuses();
        this.loadKeywords();
    }

    /**
     * Load available statuses for the filter dropdown
     */
    loadStatuses(): void {
        this._keywordService.getStatuses().subscribe({
            next: (data) => this.statuses.set(data),
            error: () => console.error('Error fetching keyword statuses')
        });
    }

    /**
     * Load keywords from API
     */
    loadKeywords(page: number = 1, append: boolean = false): void {
        if (this.isLoading()) return;

        this.isLoading.set(true);
        const filters = this.filterForm.value;

        this._keywordService.getKeywords(page, 10, filters).pipe(
            finalize(() => this.isLoading.set(false))
        ).subscribe({
            next: (res: KeywordPagination) => {
                if (append) {
                    const currentIds = new Set(this.keywords().map(k => k.id));
                    const newItems = res.data.filter(k => !currentIds.has(k.id));
                    this.keywords.update(current => [...current, ...newItems]);
                } else {
                    this.keywords.set(res.data);
                }

                this.currentPage.set(res.current_page);
                this.totalPages.set(res.last_page);
                this.hasMore.set(res.current_page < res.last_page);
            },
            error: () => {
                this._showFeedback('keywords.messages.error', 'error');
            }
        });
    }

    /**
     * Handle search/filter application
     */
    onSearch(): void {
        this.currentPage.set(1);
        this.loadKeywords(1, false);
    }

    /**
     * Reset filters and reload list
     */
    onResetFilters(): void {
        this.filterForm.reset({
            name: '',
            keyword: '',
            status: ''
        });
        this.onSearch();
    }

    /**
     * Toggle filter visibility
     */
    toggleFilters(): void {
        this.showFilters.update(v => !v);
        if (this.showFilters()) {
            setTimeout(() => {
                document.getElementById('filters-section')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }, 50);
        }
    }

    /**
     * Load next page
     */
    loadMore(): void {
        if (this.hasMore() && !this.isLoading()) {
            this.loadKeywords(this.currentPage() + 1, true);
        }
    }

    /**
     * Open modal for creating new keyword
     */
    openCreateModal(): void {
        this.editingKeyword.set(null);
        this.keywordForm.reset({ status: 'active' });
        this.isModalOpen.set(true);
    }

    /**
     * Open modal for editing existing keyword
     */
    openEditModal(keyword: Keyword): void {
        this.editingKeyword.set(keyword);
        this.keywordForm.patchValue({
            name: keyword.name,
            keyword: keyword.keyword,
            status: keyword.status,
        });
        this.isModalOpen.set(true);
    }

    /**
     * Close modal
     */
    closeModal(): void {
        this.isModalOpen.set(false);
        this.editingKeyword.set(null);
    }

    /**
     * Save keyword (Create or Update)
     */
    saveKeyword(): void {
        if (this.keywordForm.invalid) {
            this.keywordForm.markAllAsTouched();
            return;
        }

        const data = this.keywordForm.value;
        const editing = this.editingKeyword();

        this.isSaving.set(true);

        const obs$ = editing
            ? this._keywordService.updateKeyword(editing.id, data)
            : this._keywordService.createKeyword(data);

        obs$.pipe(
            finalize(() => this.isSaving.set(false))
        ).subscribe({
            next: () => {
                this._showFeedback(editing ? 'keywords.messages.updated' : 'keywords.messages.created', 'success');
                this.closeModal();
                this.loadKeywords(1, false);
            },
            error: () => {
                this._showFeedback('keywords.messages.error', 'error');
            }
        });
    }

    /**
     * Delete a keyword
     */
    deleteKeyword(keyword: Keyword): void {
        const confirmMsg = this._transloco.translate('keywords.messages.confirmDelete');
        this.keywordToDelete.set(keyword);
        this.confirmModalTitle.set('Eliminar Palabra Clave');
        this.confirmModalMessage.set(confirmMsg || '¿Está seguro de que desea eliminar esta palabra clave?');
        this.confirmModalOpen.set(true);
    }

    onConfirmDelete(): void {
        const keyword = this.keywordToDelete();
        if (keyword) {
            this._keywordService.deleteKeyword(keyword.id).subscribe({
                next: () => {
                    this._showFeedback('keywords.messages.deleted', 'success');
                    this.keywords.update(current => current.filter(k => k.id !== keyword.id));
                    this.closeConfirmModal();
                },
                error: () => {
                    this._showFeedback('keywords.messages.error', 'error');
                    this.closeConfirmModal();
                }
            });
        }
    }

    onCancelDelete(): void {
        this.closeConfirmModal();
    }

    private closeConfirmModal(): void {
        this.confirmModalOpen.set(false);
        this.keywordToDelete.set(null);
    }

    /**
     * Show feedback toast
     */
    private _showFeedback(key: string, type: 'success' | 'error'): void {
        this.feedbackMessage.set(key);
        this.feedbackType.set(type);
        setTimeout(() => this.feedbackMessage.set(null), 4000);
    }

    /**
     * Get icon path from service
     */
    getIconPath(iconName: string): string {
        return this._iconService.getIconPath(iconName);
    }
}
