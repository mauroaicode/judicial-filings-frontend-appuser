import {
  AfterViewInit,
  ChangeDetectionStrategy,
  ChangeDetectorRef,
  Component,
  ElementRef,
  forwardRef,
  inject,
  input,
  OnDestroy,
  signal,
  ViewEncapsulation,
  viewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import flatpickr from 'flatpickr';
import { Spanish } from 'flatpickr/dist/l10n/es';

@Component({
  selector: 'app-date-picker',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './date-picker.component.html',
  styleUrls: ['./date-picker.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => DatePickerComponent),
      multi: true,
    },
  ],
})
export class DatePickerComponent implements ControlValueAccessor, AfterViewInit, OnDestroy {
  private _cdr = inject(ChangeDetectorRef);

  public label = input<string | undefined>(undefined);
  public placeholder = input<string>('Seleccionar fecha');
  public size = input<'xs' | 'sm' | 'md' | 'lg'>('sm');
  public disabled = input<boolean>(false);

  public isDisabled = signal<boolean>(false);
  public inputElement = viewChild<ElementRef<HTMLInputElement>>('dateInput');
  private flatpickrInstance: flatpickr.Instance | null = null;
  private _currentValue: string | null = null;
  private _isInitialized = false;

  private _onChange: (value: string | null) => void = () => {};
  private _onTouched: () => void = () => {};

  ngAfterViewInit(): void {
    setTimeout(() => {
      this._initFlatpickr();
    }, 0);
  }

  ngOnDestroy(): void {
    if (this.flatpickrInstance) {
      this.flatpickrInstance.destroy();
      this.flatpickrInstance = null;
    }
    this._isInitialized = false;
  }

  public openPicker(): void {
    if (!this.flatpickrInstance) {
      this._initFlatpickr();
    }

    if (this.flatpickrInstance && !this.disabled() && !this.isDisabled()) {
      this.flatpickrInstance.open();
      this._alignCalendar(this.flatpickrInstance, this.inputElement()!.nativeElement);
    }
  }

  private _alignCalendar(instance: flatpickr.Instance, inputElement: HTMLInputElement): void {
    requestAnimationFrame(() => {
      const calendar = instance.calendarContainer;
      const appendTarget = this._resolveAppendTarget(inputElement);

      const inputRect = inputElement.getBoundingClientRect();
      const appendRect = appendTarget.getBoundingClientRect();
      const calendarWidth = calendar.offsetWidth;
      const appendWidth = appendTarget.clientWidth;

      let left = inputRect.left - appendRect.left;
      const top = inputRect.bottom - appendRect.top + 6;
      const maxLeft = Math.max(0, appendWidth - calendarWidth - 8);

      left = Math.min(Math.max(left, 8), maxLeft);

      calendar.style.left = `${left}px`;
      calendar.style.top = `${top}px`;
      calendar.style.right = 'auto';
      calendar.style.margin = '0';

      const arrow = calendar.querySelector('.arrowTop') as HTMLElement | null;
      if (arrow) {
        const inputCenterX = inputRect.left + inputRect.width / 2 - appendRect.left - left;
        arrow.style.left = `${Math.min(Math.max(inputCenterX - 7, 12), calendarWidth - 24)}px`;
      }
    });
  }

  private _initFlatpickr(): void {
    if (this._isInitialized) {
      return;
    }

    const inputElement = this.inputElement()?.nativeElement;
    if (!inputElement) {
      return;
    }

    const appendTarget = this._resolveAppendTarget(inputElement);

    this.flatpickrInstance = flatpickr(inputElement, {
      mode: 'single',
      dateFormat: 'Y-m-d',
      locale: Spanish,
      allowInput: true,
      clickOpens: !this.disabled() && !this.isDisabled(),
      disableMobile: true,
      appendTo: appendTarget,
      position: 'below',
      onReady: (_selectedDates, _dateStr, instance) => {
        instance.calendarContainer.classList.add('app-date-picker-calendar');
        instance.calendarContainer.style.zIndex = '10050';
      },
      onOpen: (_selectedDates, _dateStr, instance) => {
        this._alignCalendar(instance, inputElement);
      },
      onChange: (selectedDates) => {
        if (selectedDates.length === 1) {
          const date = this._formatDate(selectedDates[0]);
          this._currentValue = date;
          this._onChange(date);
        } else {
          this._currentValue = null;
          this._onChange(null);
        }
        this._onTouched();
        this._cdr.markForCheck();
      },
      onClose: () => {
        this._onTouched();
      },
    });

    this._isInitialized = true;

    if (this._currentValue) {
      this.flatpickrInstance.setDate(this._currentValue, false);
    } else {
      this.flatpickrInstance.clear();
    }

    if (this.disabled() || this.isDisabled()) {
      this.flatpickrInstance.set('clickOpens', false);
    }
  }

  private _resolveAppendTarget(inputElement: HTMLInputElement): HTMLElement {
    return inputElement.closest('.modal-box')
      || inputElement.closest('dialog')
      || inputElement.closest('.modal')
      || document.body;
  }

  writeValue(value: string | null): void {
    this._currentValue = value;
    if (this.flatpickrInstance) {
      if (value) {
        this.flatpickrInstance.setDate(value, false);
      } else {
        this.flatpickrInstance.clear();
        const inputElement = this.inputElement()?.nativeElement;
        if (inputElement) {
          inputElement.value = '';
        }
      }
    }
  }

  registerOnChange(fn: (value: string | null) => void): void {
    this._onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this._onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.isDisabled.set(isDisabled);
    if (this.flatpickrInstance) {
      this.flatpickrInstance.set('clickOpens', !isDisabled);
      const inputElement = this.inputElement()?.nativeElement;
      if (inputElement) {
        inputElement.disabled = isDisabled;
      }
    }
  }

  onBlur(): void {
    this._onTouched();
  }

  private _formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
}
