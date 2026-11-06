import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { NotificationChannelService } from '@app/core/services/config/notification-channel.service';
import {
  NotificationChannelType,
  OrganizationNotificationChannel,
  OrganizationNotificationChannelLimit,
} from '@app/core/models/notification-channel/notification-channel.model';

interface ChannelGroup {
  type: NotificationChannelType;
  items: OrganizationNotificationChannel[];
  limit: OrganizationNotificationChannelLimit | undefined;
}

@Component({
  selector: 'app-notification-channels',
  standalone: true,
  imports: [CommonModule, FormsModule, TranslocoPipe],
  templateUrl: './notification-channels.component.html',
  styleUrl: './notification-channels.component.scss',
})
export class NotificationChannelsComponent implements OnInit {
  private _channelsService = inject(NotificationChannelService);
  private _transloco = inject(TranslocoService);

  readonly channelTypes: NotificationChannelType[] = ['email', 'whatsapp', 'sms'];

  loading = signal(true);
  busyKey = signal<string | null>(null);
  loadError = signal('');
  successMessage = signal('');
  errorMessage = signal('');
  channels = signal<OrganizationNotificationChannel[]>([]);
  limits = signal<OrganizationNotificationChannelLimit[]>([]);
  drafts = signal<Record<NotificationChannelType, string>>({ email: '', whatsapp: '', sms: '' });
  editingId = signal<string | null>(null);
  editingValue = signal('');
  pendingDeleteId = signal<string | null>(null);

  groups = computed<ChannelGroup[]>(() =>
    this.channelTypes.map((type) => ({
      type,
      items: this.channels().filter((channel) => channel.channel_type === type),
      limit: this.limits().find((limit) => limit.channel_type === type),
    })),
  );

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.loadError.set('');

    this._channelsService.list().subscribe({
      next: (response) => {
        this.channels.set(response.channels ?? []);
        this.limits.set(response.limits?.channels ?? []);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.loadError.set(this._errorText(err, 'notificationChannels.loadError'));
      },
    });
  }

  isComingSoon(type: NotificationChannelType): boolean {
    return type === 'whatsapp' || type === 'sms';
  }

  isPendingValidation(channel: OrganizationNotificationChannel): boolean {
    return channel.channel_type === 'email' && channel.is_validated === false;
  }

  typeLabel(type: NotificationChannelType, count = 2): string {
    const key = count === 1 ? 'typeLabelsOne' : 'typeLabels';
    return this._transloco.translate(`notificationChannels.${key}.${type}`);
  }

  setDraft(type: NotificationChannelType, value: string): void {
    this.drafts.update((current) => ({ ...current, [type]: value }));
  }

  add(type: NotificationChannelType): void {
    if (this.isComingSoon(type)) {
      return;
    }

    const limit = this.limits().find((item) => item.channel_type === type);
    if (limit && !limit.can_add) {
      this.errorMessage.set(
        this._transloco.translate('notificationChannels.atLimit', {
          limit: limit.limit,
          label: this.typeLabel(type, limit.limit),
        }),
      );
      return;
    }

    const value = this.drafts()[type].trim();
    if (!value || this.busyKey()) {
      return;
    }

    this.busyKey.set(`add:${type}`);
    this._clearMessages();

    this._channelsService.create({ channel_type: type, channel_value: value }).subscribe({
      next: (created) => {
        this.setDraft(type, '');
        const key = this.isPendingValidation(created)
          ? 'notificationChannels.createPending'
          : 'notificationChannels.createSuccess';
        this.successMessage.set(this._transloco.translate(key));
        this.busyKey.set(null);
        this.reload();
      },
      error: (err) => {
        this.busyKey.set(null);
        this.errorMessage.set(this._errorText(err, 'notificationChannels.saveError'));
      },
    });
  }

  startEdit(channel: OrganizationNotificationChannel): void {
    this.pendingDeleteId.set(null);
    this.editingId.set(channel.id);
    this.editingValue.set(channel.channel_value);
  }

  cancelEdit(): void {
    this.editingId.set(null);
    this.editingValue.set('');
  }

  saveEdit(channel: OrganizationNotificationChannel): void {
    const value = this.editingValue().trim();
    if (!value || this.busyKey()) {
      return;
    }

    this.busyKey.set(channel.id);
    this._clearMessages();

    this._channelsService.update(channel.id, { channel_value: value }).subscribe({
      next: (updated) => {
        this.cancelEdit();
        const key = this.isPendingValidation(updated)
          ? 'notificationChannels.updatePending'
          : 'notificationChannels.saveSuccess';
        this.successMessage.set(this._transloco.translate(key));
        this.busyKey.set(null);
        this.reload();
      },
      error: (err) => {
        this.busyKey.set(null);
        this.errorMessage.set(this._errorText(err, 'notificationChannels.saveError'));
      },
    });
  }

  toggleActive(channel: OrganizationNotificationChannel): void {
    if (this.busyKey()) {
      return;
    }

    this.busyKey.set(channel.id);
    this._clearMessages();

    this._channelsService.update(channel.id, { is_active: !channel.is_active }).subscribe({
      next: (updated) => {
        this.channels.update((current) => current.map((item) => (item.id === updated.id ? updated : item)));
        this.busyKey.set(null);
      },
      error: (err) => {
        this.busyKey.set(null);
        this.errorMessage.set(this._errorText(err, 'notificationChannels.saveError'));
      },
    });
  }

  resend(channel: OrganizationNotificationChannel): void {
    if (!this.isPendingValidation(channel) || this.busyKey()) {
      return;
    }

    this.busyKey.set(channel.id);
    this._clearMessages();

    this._channelsService.resendVerification(channel.id).subscribe({
      next: () => {
        this.successMessage.set(this._transloco.translate('notificationChannels.resendSuccess'));
        this.busyKey.set(null);
      },
      error: (err) => {
        this.busyKey.set(null);
        this.errorMessage.set(this._errorText(err, 'notificationChannels.resendError'));
      },
    });
  }

  askDelete(channel: OrganizationNotificationChannel): void {
    this.cancelEdit();
    this.pendingDeleteId.set(channel.id);
  }

  cancelDelete(): void {
    this.pendingDeleteId.set(null);
  }

  confirmDelete(channel: OrganizationNotificationChannel): void {
    if (this.busyKey()) {
      return;
    }

    this.busyKey.set(channel.id);
    this._clearMessages();

    this._channelsService.delete(channel.id).subscribe({
      next: () => {
        this.pendingDeleteId.set(null);
        this.successMessage.set(this._transloco.translate('notificationChannels.deleteSuccess'));
        this.busyKey.set(null);
        this.reload();
      },
      error: (err) => {
        this.busyKey.set(null);
        this.errorMessage.set(this._errorText(err, 'notificationChannels.saveError'));
      },
    });
  }

  private reload(): void {
    this._channelsService.list().subscribe({
      next: (response) => {
        this.channels.set(response.channels ?? []);
        this.limits.set(response.limits?.channels ?? []);
      },
      error: (err) => {
        this.errorMessage.set(this._errorText(err, 'notificationChannels.loadError'));
      },
    });
  }

  private _clearMessages(): void {
    this.successMessage.set('');
    this.errorMessage.set('');
  }

  private _errorText(err: { error?: unknown }, fallbackKey: string): string {
    const body = err?.error;
    if (body && typeof body === 'object') {
      const errors = (body as { errors?: Record<string, string[]> }).errors;
      if (errors) {
        for (const messages of Object.values(errors)) {
          if (Array.isArray(messages) && typeof messages[0] === 'string' && messages[0].trim()) {
            return messages[0].trim();
          }
        }
      }

      const message = (body as { message?: unknown }).message;
      if (typeof message === 'string' && message.trim() && message.trim() !== 'The given data was invalid.') {
        return message.trim();
      }
    }

    return this._transloco.translate(fallbackKey);
  }
}
