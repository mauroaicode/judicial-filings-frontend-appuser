import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { TitleSystemAuth } from '@app/shared/components/title-system-auth/title-system-auth';

type ConfirmationStatus = 'ok' | 'expired' | 'invalid';

@Component({
  selector: 'app-confirm-notification-email',
  standalone: true,
  imports: [RouterLink, TranslocoPipe, TitleSystemAuth],
  templateUrl: './confirm-notification-email.component.html',
})
export class ConfirmNotificationEmailComponent implements OnInit {
  private _route = inject(ActivatedRoute);

  status = signal<ConfirmationStatus>('invalid');

  ngOnInit(): void {
    const value = this._route.snapshot.queryParamMap.get('estado');
    if (value === 'ok' || value === 'expired' || value === 'invalid') {
      this.status.set(value);
    }
  }
}
