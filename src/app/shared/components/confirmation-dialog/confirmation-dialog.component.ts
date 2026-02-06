import {
  ChangeDetectionStrategy,
  Component,
  input,
  output,
  ViewEncapsulation,
} from '@angular/core';
import { CommonModule } from '@angular/common';

/**
 * Reusable confirmation dialog (DaisyUI modal).
 * Use for confirm/cancel flows: delete, mark as viewed, etc.
 */
@Component({
  selector: 'app-confirmation-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './confirmation-dialog.component.html',
  styleUrls: ['./confirmation-dialog.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmationDialogComponent {
  /** Whether the dialog is open */
  open = input.required<boolean>();
  /** Dialog title */
  title = input.required<string>();
  /** Body message */
  message = input.required<string>();
  /** Confirm button label */
  confirmLabel = input<string>('Confirmar');
  /** Cancel button label */
  cancelLabel = input<string>('Cancelar');
  /** DaisyUI button class for confirm (e.g. 'btn-primary', 'btn-accent') */
  confirmClass = input<string>('btn-primary');

  confirm = output<void>();
  cancel = output<void>();

  onConfirm(): void {
    this.confirm.emit();
  }

  onCancel(): void {
    this.cancel.emit();
  }
}
