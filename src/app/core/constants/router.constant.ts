export const ROUTES_ADMIN = {
  DASHBOARD: '/admin/dashboard',
  GESTION_PROCESOS: '/admin/gestion-procesos',
  SIGN_IN: '/sign-in',
  SIGN_OUT: '/sign-out',
} as const;

export type RoleName = 'super_admin' | 'admin' | 'secretary';

export const ROLE_ROUTE_MAP: Record<RoleName, string> = {
  super_admin: ROUTES_ADMIN.GESTION_PROCESOS,
  admin: ROUTES_ADMIN.GESTION_PROCESOS, // TODO: Define route for admin role
  secretary: ROUTES_ADMIN.GESTION_PROCESOS, // TODO: Define route for secretary role
} as const;

