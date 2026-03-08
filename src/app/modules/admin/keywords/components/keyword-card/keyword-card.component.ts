import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Keyword } from '@app/core/models/keyword/keyword.model';
import { TranslocoModule } from '@jsverse/transloco';
import { IconService } from '@app/core/services/icon/icon.service';

@Component({
    selector: 'app-keyword-card',
    standalone: true,
    imports: [CommonModule, TranslocoModule],
    templateUrl: './keyword-card.component.html',
    changeDetection: ChangeDetectionStrategy.OnPush,
})
export class KeywordCardComponent {
    private _iconService = inject(IconService);

    @Input({ required: true }) keyword!: Keyword;
    @Output() onEdit = new EventEmitter<Keyword>();
    @Output() onDelete = new EventEmitter<Keyword>();

    getIconPath(iconName: string): string {
        return this._iconService.getIconPath(iconName);
    }
}
