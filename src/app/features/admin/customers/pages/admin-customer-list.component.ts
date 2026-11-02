import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { adminPageWindowWithEdges } from '../../../../shared/utils/admin-table-pagination';
import { AdminCustomer, AdminCustomerService } from '../services/admin-customer.service';

@Component({
  selector: 'app-admin-customer-list',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, AdminCatalogShellComponent],
  templateUrl: './admin-customer-list.component.html',
  styleUrl: './admin-customer-list.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminCustomerListComponent {
  private readonly service = inject(AdminCustomerService);
  readonly customers = signal<AdminCustomer[]>([]);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly search = signal('');
  readonly activation = signal('');
  readonly account = signal('');
  readonly page = signal(1);
  readonly pageSize = 7;

  readonly filtered = computed(() => {
    const q = this.search().trim().toLocaleLowerCase('vi');
    return this.customers().filter(customer => {
      const searchable = [customer.fullName, customer.phone, customer.email]
        .filter(Boolean).join(' ').toLocaleLowerCase('vi');
      return (!q || searchable.includes(q)) &&
        (!this.activation() || customer.activationStatus === this.activation()) &&
        (!this.account() || customer.accountStatus === this.account());
    });
  });
  readonly totalPages = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize)));
  readonly pageNumbers = computed(() => adminPageWindowWithEdges(this.page(), this.totalPages()));
  readonly rows = computed(() => this.filtered().slice((this.page() - 1) * this.pageSize, this.page() * this.pageSize));

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.service.listCustomers().pipe(finalize(() => this.loading.set(false))).subscribe({
      next: customers => this.customers.set(customers),
      error: () => this.error.set('Không thể tải danh sách khách hàng.'),
    });
  }

  onFilter(): void { this.page.set(1); }
  goToPage(page: number): void {
    this.page.set(Math.max(1, Math.min(page, this.totalPages())));
  }
  activationLabel(value: string): string {
    return ({ACTIVATED:'Đã kích hoạt',PENDING_ACTIVATION:'Chờ kích hoạt',NO_ACCOUNT:'Chưa có tài khoản'} as Record<string,string>)[value] ?? value;
  }
  accountLabel(value?: string | null): string {
    if (!value) return 'Chưa áp dụng';
    return value === 'BLOCKED' ? 'Đã chặn' : value === 'ACTIVE' ? 'Đang hoạt động' : value;
  }
  when(value?: string | null): string {
    if (!value) return '—';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('vi-VN', {day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});
  }
}
