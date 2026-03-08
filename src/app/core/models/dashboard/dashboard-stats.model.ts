/**
 * Dashboard stats - Notifications by type (from API)
 */
export interface DashboardStatsNotificationsByType {
  actuacion: number;
  actuacion_alerta: number;
}

/**
 * Dashboard stats response from GET dashboard/stats
 */
export interface DashboardStats {
  total_processes: number;
  active_processes: number;
  inactive_processes: number;
  processes_with_multiple_instances: number;
  notifications: {
    by_type: DashboardStatsNotificationsByType;
  };
}

/**
 * Card type for dashboard stats (used for click navigation)
 */
export type DashboardStatsCardType =
  | 'total_processes'
  | 'active_processes'
  | 'inactive_processes'
  | 'processes_with_multiple_instances'
  | 'actuacion'
  | 'actuacion_alerta';
