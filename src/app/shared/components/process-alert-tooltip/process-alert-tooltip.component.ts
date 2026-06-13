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

  /** Contexto del mensaje: inactividad (por rol) o keywords (independiente del rol) */
  public messageContext = input<'inactivity' | 'keyword'>('inactivity');

  /**
   * Obtiene la llave de traducción para el mensaje del tooltip del semáforo
   */
  public getAlertTooltipMessage(): string {
    const level = this.alertLevel();
    const role = this.normalizeRole(this.lawyerRole());

    if (!level) return '';

    if (this.messageContext() === 'keyword') {
      const keywordKeys: Record<'red' | 'yellow' | 'green', string> = {
        red: 'redGeneral',
        yellow: 'yellowGeneral',
        green: 'greenGeneral',
      };
      return `alertSemafor.alerts.${keywordKeys[level]}`;
    }

    if (role === 'plaintiff') {
      const plaintiffKeys: Record<'red' | 'yellow' | 'green', string> = {
        red: 'redDemandante',
        yellow: 'yellowDemandante',
        green: 'greenDemandante',
      };
      return `alertSemafor.alerts.${plaintiffKeys[level]}`;
    }

    if (role === 'defendant') {
      const defendantKeys: Record<'red' | 'yellow' | 'green', string> = {
        red: 'redDemandado',
        yellow: 'yellowDemandado',
        green: 'greenDemandado',
      };
      return `alertSemafor.alerts.${defendantKeys[level]}`;
    }

    const generalKeys: Record<'red' | 'yellow' | 'green', string> = {
      red: 'redGeneral',
      yellow: 'yellowGeneral',
      green: 'greenGeneral',
    };
    return `alertSemafor.alerts.${generalKeys[level]}`;
  }

  /**
   * Devuelve la llave de traducción del rol del abogado.
   * Soporta valores normalizados (plaintiff/defendant) y etiquetas en español.
   */
  public getLawyerRoleLabelKey(): string | null {
    const normalizedRole = this.normalizeRole(this.lawyerRole());

    if (normalizedRole === 'plaintiff') {
      return 'gestionProcesos.filters.plaintiff';
    }

    if (normalizedRole === 'defendant') {
      return 'gestionProcesos.filters.defendant';
    }

    return null;
  }

  private normalizeRole(role: string | null | undefined): 'plaintiff' | 'defendant' | null {
    if (!role) {
      return null;
    }

    const normalized = role.trim().toLowerCase();

    if (normalized === 'plaintiff' || normalized.includes('demandante')) {
      return 'plaintiff';
    }

    if (normalized === 'defendant' || normalized.includes('demandado')) {
      return 'defendant';
    }

    return null;
  }
}
