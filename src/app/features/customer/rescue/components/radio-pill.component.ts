import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

/**
 * RadioPill — chuyển từ React: src/components/rescue/AdoptionApplicationModal.jsx
 *
 * Ghi chú chuyển đổi:
 *  - output onChange được gọi với 2 tham số -> gộp thành mảng
 */
@Component({
  selector: 'label[app-radio-pill]',
  standalone: true,
  imports: [],
  templateUrl: './radio-pill.component.html',
  styleUrl: './radio-pill.component.scss',
  host: {
    '[class]': '`flex cursor-pointer items-center gap-[18px] rounded-[8px] bg-white text-[16px] leading-6 text-[rgba(0,0,0,0.87)] ${ framed() ? \'min-h-[52px] border-2 border-[#D9E3F6] px-[26px] py-[14px]\' : \'\' } ${invalid() && framed() ? \'border-[#c62828] ring-1 ring-[#c62828]\' : \'\'}`',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RadioPillComponent {
  // --- Input / Output (props của React) ---
  readonly question = input<any>(undefined);
  readonly option = input<any>(undefined);
  readonly checked = input<any>(undefined);
  readonly onChange = output<any>();
  readonly framed = input<any>(undefined);
  readonly invalid = input<any>(undefined);

}
