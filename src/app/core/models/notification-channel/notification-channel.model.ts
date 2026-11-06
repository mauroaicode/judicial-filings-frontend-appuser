export type NotificationChannelType = 'email' | 'whatsapp' | 'sms';

export interface OrganizationNotificationChannel {
  id: string;
  organization_id: string;
  channel_type: NotificationChannelType;
  channel_value: string;
  is_active: boolean;
  is_validated: boolean;
  priority: number;
}

export interface OrganizationNotificationChannelLimit {
  channel_type: NotificationChannelType;
  limit: number;
  configured_limit: number | null;
  default_limit: number;
  used: number;
  remaining: number;
  can_add: boolean;
}

export interface OrganizationNotificationChannelLimits {
  default_limit: number;
  channels: OrganizationNotificationChannelLimit[];
}

export interface OrganizationNotificationChannelsResponse {
  channels: OrganizationNotificationChannel[];
  limits: OrganizationNotificationChannelLimits;
}

export interface StoreNotificationChannelPayload {
  channel_type: NotificationChannelType;
  channel_value: string;
  is_active?: boolean;
}

export interface UpdateNotificationChannelPayload {
  channel_type?: NotificationChannelType;
  channel_value?: string;
  is_active?: boolean;
}
