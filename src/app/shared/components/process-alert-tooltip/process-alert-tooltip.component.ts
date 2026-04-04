import { ChangeDetectionStrategy, Component, input, ViewEncapsulation } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';

@Component({
  selector: 'app-process-alert-tooltip',
  standalone: true,
  imports: [CommonModule, TranslocoPipe],
  templateUrl: './process-alert-tooltip.component.html',
  styleUrls: ['./process-alert-tooltip.component.scss'],
  encapsulation: ViewEncapsulation.None,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProcessAlertTooltipComponent {
  /** Nivel de alerta: red, yellow, green */
  public alertLevel = input.required<'red' | 'yellow' | 'green' | null | undefined>();
  
  /** Rol del abogado: Demandante, Demandado */
  public lawyerRole = input<string | null | undefined>();

  /** Posición del tooltip: bottom, top, left, right */
  public position = input<'bottom' | 'top' | 'left' | 'right'>('top');

  /** Alineación específica (opcional) */
  public leftAligned = input<boolean>(false);

  /** Desactivar el cursor de ayuda */
  public disableTrigger = input<boolean>(false);

  /**
   * Obtiene la llave de traducción para el mensaje del tooltip del semáforo
   */
  public getAlertTooltipMessage(): string {
    const level = this.alertLevel();
    const role = this.lawyerRole();
    
    if (!level) return '';
    
    let tooltipKey = '';
    
    if (level === 'red') {
      tooltipKey = role === 'Demandante' ? 'redDemandante' : 'redGeneral';
    } else if (level === 'yellow') {
      tooltipKey = role === 'Demandante' ? 'yellowDemandante' : 'yellowGeneral';
    } else {
      tooltipKey = role === 'Demandado' ? 'greenDemandado' : (role === 'Demandante' ? 'greenDemandante' : 'greenGeneral');
    }
    
    return `actuacionesRecientes.table.alerts.${tooltipKey}`;
  }
}
