import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

import { SelectValueDirective } from '../../../../../shared/customer/directives/select-value.directive';
import { appointmentImages } from '../../../../../shared/customer/assets/appointment-images';

/**
 * SearchAndSort — chuyển từ React: src/pages/Booking/AppointmentHistoryPage.jsx
 */
@Component({
  selector: 'form[app-search-and-sort]',
  standalone: true,
  imports: [SelectValueDirective],
  templateUrl: './search-and-sort.component.html',
  styleUrl: './search-and-sort.component.scss',
  host: {
    'class': 'flex w-full gap-[10px]',
    '(submit)': 'handle1($any($event))',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SearchAndSortComponent {
  // --- Input / Output (props của React) ---
  readonly searchInput = input<any>(undefined);
  readonly onSearchInputChange = output<any>();
  readonly onSearch = output<void>();
  readonly onClearSearch = output<any>();
  readonly sortOrder = input<any>(undefined);
  readonly onSortChange = output<any>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly appointmentImages: any = appointmentImages;

  protected handle1(event: any) {
    event.preventDefault();
    this.onSearch.emit();
  }
}
