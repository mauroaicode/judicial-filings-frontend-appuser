import { Translation, TranslocoLoader, provideTransloco } from '@jsverse/transloco';
import { provideZonelessChangeDetection } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ProcessTimelineEvent } from '@app/core/models/process/process-timeline.model';
import { ProcessTimelineApiService } from '@app/core/services/process/process-timeline-api.service';
import { NEVER, Observable, of, throwError } from 'rxjs';
import { ProcessTimelineComponent } from './process-timeline.component';

class TimelineTestLoader implements TranslocoLoader {
  getTranslation(): Observable<Translation> {
    return of({
      common: { loading: 'Cargando' },
      processDetail: {
        timeline: {
          title: 'Línea de tiempo',
          subtitle: 'Eventos relevantes',
          today: 'Hoy',
          yesterday: 'Ayer',
          empty: 'Aún no hay eventos registrados para este proceso.',
          error: 'No fue posible cargar la línea de tiempo.',
          retry: 'Reintentar',
          loadMore: 'Ver eventos anteriores',
          loadingMore: 'Cargando',
          end: 'No hay eventos anteriores.',
          backfilled: 'Evento reconstruido',
          estimated: 'Fecha aproximada',
          historicalHelp: 'Evento reconstruido con información histórica.',
          notAvailable: 'Sin información',
          titles: { trackingActivated: 'Seguimiento activado', unknown: 'Evento' },
          descriptions: {
            trackingActivated: 'Se activó el seguimiento.',
            unknown: 'Evento nuevo.',
          },
          actors: { system: 'Sistema', unknown: 'Sistema' },
        },
      },
    });
  }
}

describe('ProcessTimelineComponent', () => {
  let api: jasmine.SpyObj<ProcessTimelineApiService>;

  beforeEach(async () => {
    api = jasmine.createSpyObj<ProcessTimelineApiService>('ProcessTimelineApiService', [
      'getTimeline',
    ]);

    await TestBed.configureTestingModule({
      imports: [ProcessTimelineComponent],
      providers: [
        provideZonelessChangeDetection(),
        { provide: ProcessTimelineApiService, useValue: api },
        provideTransloco({
          config: {
            availableLangs: ['es'],
            defaultLang: 'es',
            fallbackLang: 'es',
            reRenderOnLangChange: true,
            prodMode: true,
          },
          loader: TimelineTestLoader,
        }),
      ],
    }).compileComponents();
  });

  it('renders a vertical skeleton during the initial request', () => {
    api.getTimeline.and.returnValue(NEVER);
    const element = render();
    expect(element.querySelectorAll('.timeline-skeleton__item').length).toBe(3);
    expect(element.querySelector('.timeline-skeleton')?.getAttribute('aria-busy')).toBe('true');
  });

  it('renders the empty state', () => {
    api.getTimeline.and.returnValue(of(response([])));
    const element = render();
    expect(element.querySelector('.timeline-state')?.textContent).toContain(
      'Aún no hay eventos'
    );
  });

  it('renders error and retry controls', () => {
    api.getTimeline.and.returnValue(throwError(() => new Error('network')));
    const element = render();
    expect(element.querySelector('[role="alert"]')).toBeTruthy();
    expect(element.querySelector('button')?.textContent).toContain('Reintentar');
  });

  it('groups events by local day and keeps newest events first', () => {
    api.getTimeline.and.returnValue(
      of(
        response([
          event('older', '2026-07-15T09:00:00'),
          event('newest', '2026-07-16T10:30:00'),
          event('middle', '2026-07-16T09:00:00'),
        ])
      )
    );
    const element = render();
    expect(element.querySelectorAll('.timeline-group').length).toBe(2);
    const items = Array.from(element.querySelectorAll('app-process-timeline-item'));
    expect(items.map((item) => item.getAttribute('ng-reflect-event'))).toBeDefined();
    const articles = Array.from(element.querySelectorAll('article'));
    expect(articles.length).toBe(3);
    expect(articles[0].querySelector('time')?.textContent).toContain('10:30');
  });

  it('hides reconstructed and approximate technical metadata when display requests it', () => {
    api.getTimeline.and.returnValue(
      of(
        response([
          event('historical', '2026-07-16T10:30:00', {
            is_backfilled: true,
            occurred_at_is_estimated: true,
            display: {
              title: 'Seguimiento activado',
              summary: 'Se activó el seguimiento.',
              reason: null,
              role: null,
              from: null,
              to: null,
              source: 'Sistema',
              actor: 'Sistema',
              show_technical_metadata: false,
            },
          }),
        ])
      )
    );
    const element = render();
    expect(element.textContent).not.toContain('Evento reconstruido');
    expect(element.textContent).not.toContain('Fecha aproximada');
    expect(element.querySelector('time')?.textContent).not.toContain('≈');
    expect(element.querySelector('time')?.getAttribute('datetime')).toBe(
      '2026-07-16T10:30:00'
    );
  });

  it('uses semantic sections and time elements for responsive accessible markup', () => {
    api.getTimeline.and.returnValue(of(response([event('one', '2026-07-16T10:30:00')])));
    const element = render();
    expect(element.querySelector('section[aria-label]')).toBeTruthy();
    expect(element.querySelector('article time[datetime]')).toBeTruthy();
    expect(element.querySelector('table')).toBeNull();
  });

  function render(): HTMLElement {
    const fixture = TestBed.createComponent(ProcessTimelineComponent);
    fixture.componentRef.setInput('processId', 'process-a');
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  function response(data: ProcessTimelineEvent[]) {
    return {
      current_page: 1,
      data,
      last_page: 1,
      next_page_url: null,
      per_page: 20,
      total: data.length,
    };
  }

  function event(
    id: string,
    occurredAt: string,
    overrides: Partial<ProcessTimelineEvent> = {}
  ): ProcessTimelineEvent {
    return {
      id,
      event_type: 'tracking_activated',
      source: 'system',
      process_id: 'process-a',
      process_number: '76001333301820180024701',
      organization_id: null,
      subject_type: null,
      subject_id: null,
      actor_type: 'system',
      actor_id: null,
      payload: {},
      display: {
        title: 'Seguimiento activado',
        summary: null,
        reason: null,
        role: null,
        from: null,
        to: null,
        source: 'Sistema',
        actor: 'Sistema',
        time: '10:30 AM',
        show_technical_metadata: false,
      },
      occurred_at: occurredAt,
      recorded_at: occurredAt,
      is_backfilled: false,
      occurred_at_is_estimated: false,
      ...overrides,
    };
  }
});
