/**
 * Dashboard stats - Notifications by type (from API)
 */
export interface DashboardStatsNotificationsByType {
  actuacion: number;
  actuacion_alerta: number;
}

/**
 * Semaphore counts from dashboard stats API
 */
export interface DashboardStatsSemaphores {
  red: number;
  yellow: number;
  green: number;
}

/**
 * Dashboard stats response from GET dashboard/stats
 */
export interface DashboardStats {
  total_processes: number;
  active_processes: number;
  inactive_processes: number;
  processes_with_multiple_instances: number;
  pending_manual_registrations?: number;
  semaphores?: DashboardStatsSemaphores;
  notifications: {
    by_type: DashboardStatsNotificationsByType;
  };
}

export type SemaphoreColor = 'red' | 'yellow' | 'green';

/**
 * Card type for dashboard stats (used for click navigation)
 */
export type DashboardStatsCardType =
  | 'total_processes'
  | 'active_processes'
  | 'inactive_processes'
  | 'processes_with_multiple_instances'
  | 'pending_manual_registrations'
  | 'actuacion'
  | 'actuacion_alerta';
