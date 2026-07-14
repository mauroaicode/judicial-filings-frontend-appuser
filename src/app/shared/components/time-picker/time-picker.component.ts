import {
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  computed,
  effect,
  forwardRef,
  inject,
  input,
  signal,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { TranslocoModule } from '@jsverse/transloco';
import { timeToMinutes } from '@app/core/utils/local-datetime.util';

type DayPeriod = 'am' | 'pm';

@Component({
  selector: 'app-time-picker',
  standalone: true,
  imports: [CommonModule, TranslocoModule],
  templateUrl: './time-picker.component.html',
  styleUrls: ['./time-picker.component.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => TimePickerComponent),
      multi: true,
    },
  ],
})
export class TimePickerComponent implements ControlValueAccessor {
  private _cdr = inject(ChangeDetectorRef);

  public label = input<string | undefined>(undefined);
  public placeholder = input<string>('Seleccionar hora');
  public hint = input<string | undefined>(undefined);
  public disabled = input<boolean>(false);
  /** Earliest selectable time (`HH:mm`). Used when due date is today. */
  public minTime = input<string | null>(null);

  public isDisabled = signal(false);
  public isOpen = signal(false);
  public displayValue = signal('');

  public readonly hours = Array.from({ length: 12 }, (_, i) => i + 1);
  public readonly minutes = Array.from({ length: 12 }, (_, i) => i * 5);

  public draftHour = signal(12);
  public draftMinute = signal(0);
  public draftPeriod = signal<DayPeriod>('am');

  private _value: string | null = null;
  private _onChange: (value: string | null) => void = () => {};
  private _onTouched: () => void = () => {};

  public readonly draftIsValid = computed(() => {
    const min = this.minTime();
    if (!min) {
      return true;
    }
    const draftMins = this._draftToMinutes();
    const minMins = timeToMinutes(min);
    if (draftMins === null || minMins === null) {
      return true;
    }
    return draftMins >= minMins;
  });

  constructor() {
    effect(() => {
      // Re-evaluate disabled slots when minTime changes.
      this.minTime();
      this._cdr.markForCheck();
    });
  }

  writeValue(value: string | null): void {
    this._value = this._normalizeToHhMm(value);
    this.displayValue.set(this._toDisplay(this._value));
    this._syncDraftFromValue(this._value);
    this._cdr.markForCheck();
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this._onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this._onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
    if (isDisabled) {
      this.isOpen.set(false);
    }
    this._cdr.markForCheck();
  }

  public toggleOpen(event?: Event): void {
    event?.preventDefault();
    event?.stopPropagation();

    if (this.disabled() || this.isDisabled()) {
      return;
    }

    if (this.isOpen()) {
      this.closePanel();
      return;
    }

    this._syncDraftFromValue(this._value);
    this._ensureDraftMeetsMinTime();
    this.isOpen.set(true);
    this._cdr.markForCheck();
  }

  public closePanel(): void {
    this.isOpen.set(false);
    this._onTouched();
    this._cdr.markForCheck();
  }

  public selectHour(hour: number): void {
    if (this.isHourDisabled(hour)) {
      return;
    }
    this.draftHour.set(hour);
    this._clampDraftMinuteToMin();
    this._cdr.markForCheck();
  }

  public selectMinute(minute: number): void {
    if (this.isMinuteDisabled(minute)) {
      return;
    }
    this.draftMinute.set(minute);
    this._cdr.markForCheck();
  }

  public selectPeriod(period: DayPeriod): void {
    if (this.isPeriodDisabled(period)) {
      return;
    }
    this.draftPeriod.set(period);
    this._ensureDraftMeetsMinTime();
    this._cdr.markForCheck();
  }

  public confirm(): void {
    if (!this.draftIsValid()) {
      return;
    }
    const value = this._combineDraft();
    this._value = value;
    this.displayValue.set(this._toDisplay(value));
    this._onChange(value);
    this._onTouched();
    this.isOpen.set(false);
    this._cdr.markForCheck();
  }

  public clearTime(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
    this._value = null;
    this.displayValue.set('');
    this.draftHour.set(12);
    this.draftMinute.set(0);
    this.draftPeriod.set('am');
    this._onChange(null);
    this._onTouched();
    this.isOpen.set(false);
    this._cdr.markForCheck();
  }

  public onBlur(): void {
    this._onTouched();
  }

  public padMinute(minute: number): string {
    return minute.toString().padStart(2, '0');
  }

  public isPeriodDisabled(period: DayPeriod): boolean {
    const min = this.minTime();
    if (!min) {
      return false;
    }
    const minMins = timeToMinutes(min);
    if (minMins === null) {
      return false;
    }
    // Latest slot in AM is 11:55 (715). Latest in PM is 23:55.
    const periodMax = period === 'am' ? 11 * 60 + 55 : 23 * 60 + 55;
    return periodMax < minMins;
  }

  public isHourDisabled(hour12: number): boolean {
    const min = this.minTime();
    if (!min) {
      return false;
    }
    const minMins = timeToMinutes(min);
    if (minMins === null) {
      return false;
    }
    const period = this.draftPeriod();
    // Latest minute for this hour still usable?
    const hourMax = this._to24hMinutes(period, hour12, 55);
    return hourMax < minMins;
  }

  public isMinuteDisabled(minute: number): boolean {
    const min = this.minTime();
    if (!min) {
      return false;
    }
    const minMins = timeToMinutes(min);
    if (minMins === null) {
      return false;
    }
    const slot = this._to24hMinutes(this.draftPeriod(), this.draftHour(), minute);
    return slot < minMins;
  }

  private _ensureDraftMeetsMinTime(): void {
    const min = this.minTime();
    if (!min) {
      return;
    }
    const minMins = timeToMinutes(min);
    if (minMins === null) {
      return;
    }
    if ((this._draftToMinutes() ?? 0) >= minMins) {
      return;
    }

    const hours24 = Math.floor(minMins / 60);
    const minutes = minMins % 60;
    const period: DayPeriod = hours24 >= 12 ? 'pm' : 'am';
    let hour12 = hours24 % 12;
    if (hour12 === 0) {
      hour12 = 12;
    }

    this.draftPeriod.set(period);
    this.draftHour.set(hour12);
    this.draftMinute.set(minutes);
  }

  private _clampDraftMinuteToMin(): void {
    if (!this.isMinuteDisabled(this.draftMinute())) {
      return;
    }
    const firstValid = this.minutes.find((m) => !this.isMinuteDisabled(m));
    if (firstValid !== undefined) {
      this.draftMinute.set(firstValid);
    }
  }

  private _draftToMinutes(): number | null {
    return this._to24hMinutes(this.draftPeriod(), this.draftHour(), this.draftMinute());
  }

  private _to24hMinutes(period: DayPeriod, hour12: number, minute: number): number {
    let hours = hour12;
    if (period === 'am') {
      hours = hours === 12 ? 0 : hours;
    } else {
      hours = hours === 12 ? 12 : hours + 12;
    }
    return hours * 60 + minute;
  }

  private _syncDraftFromValue(value: string | null): void {
    if (!value) {
      this.draftHour.set(12);
      this.draftMinute.set(0);
      this.draftPeriod.set('am');
      return;
    }

    const [hoursStr, minutesStr] = value.split(':');
    let hours = Number(hoursStr);
    const minutes = Number(minutesStr);
    const period: DayPeriod = hours >= 12 ? 'pm' : 'am';
    hours = hours % 12;
    if (hours === 0) {
      hours = 12;
    }

    const snappedMinute = Math.round(minutes / 5) * 5;
    this.draftHour.set(hours);
    this.draftMinute.set(snappedMinute === 60 ? 55 : snappedMinute);
    this.draftPeriod.set(period);
  }

  private _combineDraft(): string {
    let hours = this.draftHour();
    const minutes = this.draftMinute();
    const period = this.draftPeriod();

    if (period === 'am') {
      hours = hours === 12 ? 0 : hours;
    } else {
      hours = hours === 12 ? 12 : hours + 12;
    }

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  private _normalizeToHhMm(value: string | null | undefined): string | null {
    if (!value) {
      return null;
    }

    const match = String(value).match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
    if (!match) {
      return null;
    }

    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    if (hours > 23 || minutes > 59) {
      return null;
    }

    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  private _toDisplay(value: string | null): string {
    if (!value) {
      return '';
    }

    const [hoursStr, minutesStr] = value.split(':');
    let hours = Number(hoursStr);
    const minutes = Number(minutesStr);
    const period = hours >= 12 ? 'p. m.' : 'a. m.';
    hours = hours % 12;
    if (hours === 0) {
      hours = 12;
    }

    return `${hours}:${minutes.toString().padStart(2, '0')} ${period}`;
  }
}
