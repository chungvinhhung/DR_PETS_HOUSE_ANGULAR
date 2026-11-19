import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked, OnInit } from '@angular/core';

import { ServicePricingApiService } from '../../../../../core/customer/services/api/service-pricing-api.service';
import { PriceCellGroupComponent } from './price-cell-group.component';
import { ServiceIconComponent } from './service-icon.component';
import { PricePillComponent } from './price-pill.component';
import { CustomerIconComponent } from '../../../../../shared/customer/components/icon/customer-icon.component';
import { ReactStyleDirective } from '../../../../../shared/customer/directives/react-style.directive';
import { GROOMING_PRICE_COLUMNS, SERVICE_PRICE_FILTERS, SERVICE_PRICE_TABLES } from '../../../../../shared/customer/data/grooming-data';
import { columnToneClasses } from './service-pricing-modal.helpers';

/**
 * ServicePricingModal — chuyển từ React: src/components/groomingSpa/ServicePricingModal.jsx
 */
@Component({
  selector: 'app-service-pricing-modal',
  standalone: true,
  imports: [PriceCellGroupComponent, ServiceIconComponent, PricePillComponent, CustomerIconComponent, ReactStyleDirective],
  templateUrl: './service-pricing-modal.component.html',
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
    if (this.selectedFilter() === 'all') {
      return [
        ...this.pricingTables().medical,
        ...this.pricingTables().grooming,
        ...this.pricingTables().combo,
      ]
    }

    return (this.pricingTables() as any)[this.selectedFilter()] || []
  });
  readonly activeColumns = computed<any>(() => {
    if (this.selectedFilter() !== 'all' && (this.pricingColumns() as any)[this.selectedFilter()]?.length) {
      return (this.pricingColumns() as any)[this.selectedFilter()]
    }
    return GROOMING_PRICE_COLUMNS
  });
  readonly displayColumns = computed<any>(() => {
    const columns = this.activeColumns().slice(0, 9)
    while (columns.length < 9) {
      columns.push((GROOMING_PRICE_COLUMNS as any)[columns.length])
    }
    // Keep the full meaning in a tooltip but fit within the price header.
    return columns.map((column: any, index: number) => {
      const fullLabel = String(column?.label || '');
      return index === 0 && /giá chuẩn/i.test(fullLabel)
        ? { ...column, label: 'Giá chuẩn', fullLabel }
        : column;
    });
  });
  readonly displayRows = computed<any>(() => {
    return this.rows().map((row: any) => {
      const prices = row.prices.slice(0, 9)
      while (prices.length < 9) prices.push('Liên hệ')
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
