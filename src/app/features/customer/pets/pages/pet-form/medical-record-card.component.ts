import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * MedicalRecordCard — chuyển từ React: src/pages/Pet/PetFormPage.jsx
 */
@Component({
  selector: 'div[app-medical-record-card]',
  standalone: true,
  imports: [],
  templateUrl: './medical-record-card.component.html',
  host: {
    'class': 'flex items-center justify-between p-3 border border-slate-100 rounded-lg bg-slate-50/50 hover:bg-slate-50 transition',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalRecordCardComponent {
  // --- Input / Output (props của React) ---
  readonly fileName = input<any>(undefined);
  readonly size = input<any>(undefined);
  readonly onEdit = output<any>();
  readonly onDelete = output<any>();
  readonly onDownload = output<any>();

}
