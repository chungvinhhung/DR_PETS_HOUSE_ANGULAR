import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

/**
 * FilterGroup — chuyển từ React: src/pages/Search/SearchResultsPage.jsx
 *
 * Ghi chú chuyển đổi:
 *  - output onToggle được gọi với 2 tham số -> gộp thành mảng
 */
@Component({
  selector: 'section[app-filter-group]',
  standalone: true,
  imports: [],
  templateUrl: './filter-group.component.html',
  host: {
    'class': 'w-full overflow-hidden rounded-[40px] border border-[rgba(25,118,210,0.5)] bg-white px-[30px] py-10',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterGroupComponent {
  // --- Input / Output (props của React) ---
  readonly group = input<any>(undefined);
  readonly selectedValues = input<any>(undefined);
  readonly onToggle = output<any>();

  // --- Giá trị tính toán (computed) ---
  readonly allOptionId = computed<any>(() => this.group().options.find((option: any) => option.id.startsWith("all-"))?.id);

}
