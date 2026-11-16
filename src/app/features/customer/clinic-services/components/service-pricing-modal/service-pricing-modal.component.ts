import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked, OnInit } from '@angular/core';

import { ServicePricingApiService } from '../../../../../core/customer/services/api/service-pricing-api.service';
import { ServiceIconComponent } from './service-icon.component';
import { PricePillComponent } from './price-pill.component';
import { CustomerIconComponent } from '../../../../../shared/customer/components/icon/customer-icon.component';
import { ReactStyleDirective } from '../../../../../shared/customer/directives/react-style.directive';
import { GROOMING_PRICE_COLUMNS, SERVICE_PRICE_FILTERS, SERVICE_PRICE_TABLES } from '../../../../../shared/customer/data/grooming-data';
import { columnToneClasses } from './service-pricing-modal.helpers';

const PRICE_COLUMN_COUNT = GROOMING_PRICE_COLUMNS.length;

/**
 * ServicePricingModal — chuyển từ React: src/components/groomingSpa/ServicePricingModal.jsx
 */
@Component({
  selector: 'app-service-pricing-modal',
  standalone: true,
  imports: [ServiceIconComponent, PricePillComponent, CustomerIconComponent, ReactStyleDirective],
  templateUrl: './service-pricing-modal.component.html',
  styleUrl: './service-pricing-modal.component.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServicePricingModalComponent implements OnInit {
  // --- Service dùng chung ---
  protected readonly servicePricingApi = inject(ServicePricingApiService);

  // --- Input / Output (props của React) ---
  readonly open = input<any>(undefined);
  readonly onClose = output<void>();
  readonly defaultFilter = input<any>('all');

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly SERVICE_PRICE_FILTERS: any = SERVICE_PRICE_FILTERS;
  protected readonly columnToneClasses: any = columnToneClasses;

  // --- Giá trị tính toán (computed) ---
  readonly rows = computed<any>(() => {
    const categories = this.selectedFilter() === 'all' ? ['medical', 'grooming', 'combo'] : [this.selectedFilter()]
    // Khám & Điều trị chỉ có 1 mức giá chung cho mọi cân nặng
    return categories.flatMap((category: any) =>
      ((this.pricingTables() as any)[category] || []).map((row: any) => ({ ...row, single: category === 'medical' })),
    )
  });
  /** Chỉ lọc Khám & Điều trị thì tiêu đề chỉ còn 1 cột giá */
  readonly isSingleColumn = computed<any>(() => this.selectedFilter() === 'medical');
  readonly displayColumns = computed<any>(() => {
    const apiColumns = this.selectedFilter() === 'all' ? [] : (this.pricingColumns() as any)[this.selectedFilter()] || []
    return GROOMING_PRICE_COLUMNS.map((column: any, index: any) => ({
      ...column,
      label: apiColumns[index]?.label || column.label,
    }))
  });
  readonly displayRows = computed<any>(() => {
    return this.rows().map((row: any) => {
      if (row.single) return { ...row, prices: [row.prices[0] ?? 'Liên hệ'] }
      const prices = row.prices.slice(0, PRICE_COLUMN_COUNT)
      while (prices.length < PRICE_COLUMN_COUNT) prices.push('Liên hệ')
      return { ...row, prices }
    })
  });
  readonly selectedLabel = computed<any>(() => SERVICE_PRICE_FILTERS.find(
    (filter: any) => filter.value === this.selectedFilter(),
  )?.label);

  // --- Trạng thái (signal = useState / useRef) ---
  readonly selectedFilter = signal<any>(undefined);
  readonly isDropdownOpen = signal<any>(false);
  readonly pricingTables = signal<any>(SERVICE_PRICE_TABLES);
  readonly pricingColumns = signal<any>({});

  constructor() {
    // useEffect(..., [defaultFilter, open])
    effect((onCleanup: any) => {
      this.defaultFilter();
      this.open();
      const cleanup = untracked(() => {
        if (this.open()) {
          this.selectedFilter.set(this.defaultFilter())
          this.isDropdownOpen.set(false)
        }
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });

    // useEffect(..., [open])
    effect((onCleanup: any) => {
      this.open();
      const cleanup = untracked(() => {
        if (!this.open()) return
        let active = true

        this.servicePricingApi.getServicePricingMatrix()
          .then((matrix: any) => {
            if (!active || !matrix || !Object.keys(matrix).length) return
            this.pricingTables.update((current: any) => ({
              ...current,
              medical: matrix.medical?.rows?.length ? matrix.medical.rows : current.medical,
              grooming: matrix.grooming?.rows?.length ? matrix.grooming.rows : current.grooming,
              combo: matrix.combo?.rows?.length ? matrix.combo.rows : current.combo,
            }))
            this.pricingColumns.set({
              medical: matrix.medical?.columns || [],
              grooming: matrix.grooming?.columns || [],
              combo: matrix.combo?.columns || [],
            })
          })
          .catch(() => {
            this.pricingTables.set(SERVICE_PRICE_TABLES)
            this.pricingColumns.set({})
          })

        return () => {
          active = false
        }
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });
  }

  ngOnInit(): void {
    this.selectedFilter.set(this.defaultFilter());
  }

  /** (tự sinh) global document không dùng trực tiếp được trong template */
  protected cond1(): any {
    return !this.open() || typeof document === 'undefined';
  }

  protected handle2(event: any) {
    if (event.target === event.currentTarget) {
      this.isDropdownOpen.set(false)
      this.onClose.emit()
    }
  }

  protected handle3() {
    this.isDropdownOpen.set(false)
    this.onClose.emit()
  }

  protected handle4() {
    this.isDropdownOpen.update((current: any) => !current);
  }

  protected handle5(filter: any) {
    this.selectedFilter.set(filter.value)
    this.isDropdownOpen.set(false)
  }
}
