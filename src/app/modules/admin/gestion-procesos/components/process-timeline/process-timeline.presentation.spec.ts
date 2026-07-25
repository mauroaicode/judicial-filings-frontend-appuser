import { ProcessTimelineEvent } from '@app/core/models/process/process-timeline.model';
import { presentTimelineEvent } from './process-timeline.presentation';

describe('process timeline presentation', () => {
  const translate = (key: string, params?: Record<string, string | number>): string => {
    const messages: Record<string, string> = {
      'processDetail.timeline.descriptions.private':
        'El proceso pasó de público a privado en Rama Judicial.',
      'processDetail.timeline.descriptions.sourceChanged':
        `La fuente cambió de ${params?.['from']} a ${params?.['to']}.`,
      'processDetail.timeline.descriptions.dueDateChanged':
        `Vencimiento ${params?.['from']} → ${params?.['to']}.`,
      'processDetail.timeline.descriptions.suspendedPaused': 'Semáforo pausado.',
      'processDetail.timeline.descriptions.resumed': 'Seguimiento activo.',
      'processDetail.timeline.descriptions.semaphoreChanged':
        `Semáforo ${params?.['from']} → ${params?.['to']}.`,
      'processDetail.timeline.descriptions.semaphoreRed': 'Nivel rojo.',
      'processDetail.timeline.descriptions.unknown': 'Evento nuevo.',
      'processDetail.timeline.sources.judicial_branch': 'Rama Judicial',
      'processDetail.timeline.sources.samai': 'SAMAI',
      'processDetail.timeline.semaphore.red': 'Rojo',
      'processDetail.timeline.semaphore.yellow': 'Amarillo',
      'processDetail.timeline.semaphore.green': 'Verde',
      'processDetail.timeline.semaphore.none': 'Sin nivel',
      'processDetail.timeline.notAvailable': 'Sin información',
    };
    return messages[key] ?? key;
  };

  it('presents a public-to-private event', () => {
    const result = presentTimelineEvent(event('process_became_private'), translate, 'es');
    expect(result.description).toContain('público a privado');
    expect(result.tone).toBe('warning');
  });

  it('presents a Rama Judicial to SAMAI migration', () => {
    const result = presentTimelineEvent(
      event('process_source_changed', {
        from: { data_source: 'judicial_branch' },
        to: { data_source: 'samai', samai_corporacion: 'Consejo de Estado' },
        migration: true,
      }),
      translate,
      'es'
    );
    expect(result.description).toContain('Rama Judicial');
    expect(result.description).toContain('SAMAI');
    expect(result.details[0]?.value).toBe('Consejo de Estado');
  });

  it('presents task creation details', () => {
    const result = presentTimelineEvent(
      event(
        'task_created',
        {
          title: 'Preparar recurso',
          type: 'suspension',
          status: 'pending',
          due_date: '2026-07-25T12:00:00Z',
          reminder_days: 3,
        },
        {
          display: {
            title: 'Se creó una tarea',
            summary: 'Preparar recurso',
            reason: null,
            role: null,
            from: null,
            to: null,
            task_type: 'Suspensión',
            task_status: 'Pendiente',
            source: 'Sistema',
            actor: 'Sistema',
            time: '3:07 PM',
            show_technical_metadata: false,
          },
        }
      ),
      translate,
      'es'
    );
    expect(result.description).toBe('Preparar recurso');
    expect(result.details.length).toBe(4);
    expect(result.details[0]?.value).toBe('Suspensión');
    expect(result.details[1]?.value).toBe('Pendiente');
  });

  it('presents only task update changes', () => {
    const result = presentTimelineEvent(
      event('task_updated', {
        changes: {
          due_date: {
            from: '2026-08-01T08:00:00Z',
            to: '2026-08-15T08:00:00Z',
          },
        },
      }),
      translate,
      'es'
    );
    expect(result.description).toContain('1 de agosto');
    expect(result.description).toContain('15 de agosto');
  });

  it('presents suspension and its related task without exposing IDs', () => {
    const result = presentTimelineEvent(
      event(
        'process_suspended',
        {
          from: { status: 'active' },
          to: { status: 'suspended' },
          reason: 'suspension_task_created',
          semaphore_paused: true,
          task_title: 'Negociación',
        },
        { subject_type: 'task', subject_id: 'technical-id' }
      ),
      translate,
      'es'
    );
    expect(result.description).toBe('Semáforo pausado.');
    expect(result.details.some((detail) => detail.value === 'Negociación')).toBeTrue();
    expect(JSON.stringify(result)).not.toContain('technical-id');
  });

  it('presents process resumption', () => {
    const result = presentTimelineEvent(
      event('process_resumed', { reason: 'task_completed' }),
      translate,
      'es'
    );
    expect(result.description).toBe('Seguimiento activo.');
    expect(result.tone).toBe('success');
  });

  for (const [from, to] of [
    ['red', 'yellow'],
    ['yellow', 'green'],
    ['green', 'red'],
  ]) {
    it(`presents accessible semaphore transition ${from} to ${to}`, () => {
      const result = presentTimelineEvent(
        event('semaphore_changed', { from, to }),
        translate,
        'es'
      );
      expect(result.semaphore).toEqual(
        jasmine.objectContaining({ from, to })
      );
      if (to === 'red') {
        expect(result.description).toBe('Nivel rojo.');
      } else {
        expect(result.description).toContain(translate(`processDetail.timeline.semaphore.${from}`));
        expect(result.description).toContain(translate(`processDetail.timeline.semaphore.${to}`));
      }
    });
  }

  it('prepares speaker changes visually', () => {
    const result = presentTimelineEvent(
      event('speaker_changed', { from: 'Ana', to: 'Carlos' }),
      translate,
      'es'
    );
    expect(result.tone).toBe('info');
    expect(result.iconPath).toBeTruthy();
  });

  it('falls back safely for unknown event types', () => {
    const result = presentTimelineEvent(event('future_backend_event'), translate, 'es');
    expect(result.description).toBe('Evento nuevo.');
    expect(result.iconPath).toBeTruthy();
  });

  it('prioritizes the translated backend display block', () => {
    const result = presentTimelineEvent(
      event('semaphore_changed', { from: null, to: 'green' }, {
        display: {
          title: 'Cambió el semáforo',
          summary: 'El semáforo cambió de Sin nivel anterior a Verde.',
          reason: 'Estado inicial registrado',
          role: 'Demandante',
          from: 'Sin nivel anterior',
          to: 'Verde',
          source: 'Sistema',
          actor: 'Sistema',
          show_technical_metadata: false,
        },
      }),
      translate,
      'es'
    );

    expect(result.title).toBe('Cambió el semáforo');
    expect(result.description).toContain('Sin nivel anterior');
    expect(result.details.some((detail) => detail.value === 'Estado inicial registrado')).toBeTrue();
    expect(result.details.some((detail) => detail.value === 'Demandante')).toBeTrue();
    expect(result.semaphore?.fromLabel).toBe('Sin nivel anterior');
  });

  it('renders display.dates in backend order for semaphore_changed', () => {
    const result = presentTimelineEvent(
      event(
        'semaphore_changed',
        { from: 'yellow', to: 'green', last_activity_date: '2020-01-01' },
        {
          display: {
            title: 'Cambió el semáforo',
            summary: 'El semáforo cambió de Amarillo a Verde.',
            reason: 'Nueva actuación judicial',
            role: 'Demandante',
            from: 'Amarillo',
            to: 'Verde',
            source: 'Sistema',
            actor: 'Sistema',
            dates: [
              {
                key: 'semaphore_recorded_at',
                attribute: 'occurred_at',
                label: 'Fecha del semáforo',
                value: '2026-07-25',
                formatted: '25 de julio de 2026',
              },
              {
                key: 'action_date',
                attribute: 'action_date',
                label: 'Fecha de actuación',
                value: '2026-07-26',
                formatted: '26 de julio de 2026',
              },
              {
                key: 'registration_date',
                attribute: 'registration_date',
                label: 'Fecha de registro',
                value: '2026-07-24',
                formatted: '24 de julio de 2026',
              },
            ],
            show_technical_metadata: false,
          },
        }
      ),
      translate,
      'es'
    );

    const dateDetails = result.details.filter((detail) =>
      [
        'Fecha del semáforo',
        'Fecha de actuación',
        'Fecha de registro',
      ].includes(detail.label)
    );

    expect(dateDetails).toEqual([
      { label: 'Fecha del semáforo', value: '25 de julio de 2026' },
      { label: 'Fecha de actuación', value: '26 de julio de 2026' },
      { label: 'Fecha de registro', value: '24 de julio de 2026' },
    ]);
    expect(result.details.some((detail) => detail.label === 'processDetail.timeline.fields.lastActivity')).toBeFalse();
  });

  it('does not render a dates block when display.dates is empty', () => {
    const result = presentTimelineEvent(
      event(
        'semaphore_changed',
        { from: 'yellow', to: 'green', last_activity_date: '2026-07-01' },
        {
          display: {
            title: 'Cambió el semáforo',
            summary: null,
            reason: null,
            role: null,
            from: 'Amarillo',
            to: 'Verde',
            source: 'Sistema',
            actor: 'Sistema',
            dates: [],
            show_technical_metadata: false,
          },
        }
      ),
      translate,
      'es'
    );

    expect(result.details.some((detail) => detail.label === 'processDetail.timeline.fields.lastActivity')).toBeFalse();
    expect(result.details.some((detail) => detail.label.startsWith('Fecha'))).toBeFalse();
  });

  it('renders display.dates for speaker_changed', () => {
    const result = presentTimelineEvent(
      event(
        'speaker_changed',
        { from: 'Ana', to: 'Carlos' },
        {
          display: {
            title: 'Cambió el ponente',
            summary: 'El ponente cambió de Ana a Carlos.',
            reason: null,
            role: null,
            from: 'Ana',
            to: 'Carlos',
            source: 'Sistema',
            actor: 'Sistema',
            dates: [
              {
                key: 'speaker_changed_at',
                attribute: 'occurred_at',
                label: 'Fecha del cambio de ponente',
                value: '2026-07-25',
                formatted: '25 de julio de 2026',
              },
            ],
            show_technical_metadata: false,
          },
        }
      ),
      translate,
      'es'
    );

    expect(result.details).toEqual([
      { label: 'Fecha del cambio de ponente', value: '25 de julio de 2026' },
    ]);
  });

  function event(
    eventType: string,
    payload: Record<string, unknown> = {},
    overrides: Partial<ProcessTimelineEvent> = {}
  ): ProcessTimelineEvent {
    return {
      id: 'event-id',
      event_type: eventType,
      source: 'system',
      process_id: 'process-id',
      process_number: '76001333301820180024701',
      organization_id: null,
      subject_type: null,
      subject_id: null,
      actor_type: 'system',
      actor_id: null,
      payload,
      occurred_at: '2026-07-16T20:30:00.000000Z',
      recorded_at: '2026-07-16T20:30:01.000000Z',
      is_backfilled: false,
      occurred_at_is_estimated: false,
      ...overrides,
    };
  }
});
