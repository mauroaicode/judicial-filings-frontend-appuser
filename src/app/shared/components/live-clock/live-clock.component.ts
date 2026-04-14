import { Component, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-live-clock',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="flex items-center gap-3 bg-white border border-base-200 px-4 py-2.5 rounded-2xl shadow-sm shadow-base-200/50">
      <div class="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div class="flex flex-col">
        <span class="text-[9px] font-bold text-base-content/40 uppercase tracking-widest leading-none mb-1">
          Bogotá (Colombia)
        </span>
        <div class="flex items-center gap-2">
          <span class="text-sm font-bold text-base-content leading-none">
            {{ currentDate() }}
          </span>
          <span class="w-1 h-1 rounded-full bg-base-300"></span>
          <span class="text-sm font-bold text-primary leading-none lining-nums">
            {{ currentTime() }}
          </span>
        </div>
      </div>
    </div>
  `,
  styles: [`
    :host {
      display: block;
    }
  `]
})
export class LiveClockComponent implements OnInit, OnDestroy {
  public currentDate = signal<string>('');
  public currentTime = signal<string>('');
  private _intervalId: any;

  ngOnInit(): void {
    this._updateClock();
    // Update every second
    this._intervalId = setInterval(() => this._updateClock(), 1000);
  }

  private _updateClock(): void {
    const now = new Date();
    
    // Format date: "martes, 31 de marzo de 2026"
    this.currentDate.set(now.toLocaleDateString('es-CO', {
      timeZone: 'America/Bogota',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    }).replace(/^\w/, (c) => c.toUpperCase()));

    // Format time: "07:30:15 PM"
    this.currentTime.set(now.toLocaleTimeString('es-CO', {
      timeZone: 'America/Bogota',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    }));
  }

  ngOnDestroy(): void {
    if (this._intervalId) {
      clearInterval(this._intervalId);
    }
  }
}
