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
import { CommonModule } from '@angular/common';
import { TranslocoModule } from '@jsverse/transloco';
import { NotificationDigestHistoryService } from '@app/core/services/notification/notification-digest-history.service';
import { NotificationDigestHistory } from '@app/core/models/notification/notification-digest-history.model';
import { finalize } from 'rxjs';

@Component({
  selector: 'app-actuaciones-recientes',
  standalone: true,
  imports: [CommonModule, TranslocoModule],
  templateUrl: './actuaciones-recientes.component.html',
  styleUrls: ['./actuaciones-recientes.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActuacionesRecientesComponent implements OnInit, OnDestroy {
  private _historyService = inject(NotificationDigestHistoryService);
  
  // Signals for state management
  public historyItems = signal<NotificationDigestHistory[]>([]);
  public loading = signal<boolean>(false);
  public currentPage = signal<number>(1);
  public totalItems = signal<number>(0);
  public hasMorePages = signal<boolean>(true);

  @ViewChild('loadingTrigger') loadingTrigger!: ElementRef;
  private _observer!: IntersectionObserver;

  ngOnInit(): void {
    this.loadHistory();
    this.setupInfiniteScroll();
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
    
    this._historyService.getHistory(this.currentPage())
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
    const p = period.toLowerCase();
    if (p.includes('mañana')) return 'manana';
    if (p.includes('tarde')) return 'tarde';
    if (p.includes('noche')) return 'noche';
    return 'tarde';
  }
}
