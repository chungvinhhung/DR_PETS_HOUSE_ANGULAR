import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { actionClasses } from './appointment-history-page.helpers';

/**
 * ActionButton — chuyển từ React: src/pages/Booking/AppointmentHistoryPage.jsx
 */
@Component({
  selector: 'button[app-action-button]',
  standalone: true,
  imports: [],
  templateUrl: './action-button.component.html',
  host: {
    'type': 'button',
    '(click)': 'onClick.emit(action().key)',
    '[disabled]': 'disabled()',
    '[class]': '`focus-ring-brand inline-flex h-[38px] items-center justify-center rounded px-[22px] py-2 font-[\'Roboto\'] text-[15px] font-medium uppercase leading-[26px] tracking-[0.46px] transition disabled:cursor-not-allowed disabled:border-transparent disabled:bg-[#e4e7ec] disabled:text-[#98a2b3] disabled:shadow-none ${actionClasses[action().variant]}`',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActionButtonComponent {
  // --- Input / Output (props của React) ---
  readonly action = input<any>(undefined);
  readonly onClick = output<any>();
  readonly disabled = input<any>(false);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly actionClasses: any = actionClasses;

}
