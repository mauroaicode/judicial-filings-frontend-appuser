import { Injectable, OnDestroy } from '@angular/core';
import { Observable, Subject } from 'rxjs';

/**
 * Notifies interested views that a process should be refetched
 * (e.g. suspension task completed → status back to Activo).
 * Also broadcasts across browser tabs via BroadcastChannel when available.
 */
@Injectable({
  providedIn: 'root',
})
export class ProcessRefreshService implements OnDestroy {
  private readonly _refresh$ = new Subject<string>();
  private _channel: BroadcastChannel | null = null;
  private static readonly CHANNEL_NAME = 'notijudicial-process-refresh';

  readonly refreshed$: Observable<string> = this._refresh$.asObservable();

  constructor() {
    if (typeof BroadcastChannel === 'undefined') {
      return;
    }

    try {
      this._channel = new BroadcastChannel(ProcessRefreshService.CHANNEL_NAME);
      this._channel.onmessage = (event: MessageEvent<{ processId?: string }>) => {
        const processId = event?.data?.processId;
        if (processId) {
          this._refresh$.next(processId);
        }
      };
    } catch {
      this._channel = null;
    }
  }

  requestRefresh(processId: string | null | undefined): void {
    if (!processId) {
      return;
    }

    this._refresh$.next(processId);

    try {
      this._channel?.postMessage({ processId });
    } catch {
      // ignore
    }
  }

  ngOnDestroy(): void {
    this._channel?.close();
    this._channel = null;
    this._refresh$.complete();
  }
}
