import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { finalize, forkJoin } from 'rxjs';

import { AdminDataStateComponent } from '../../../../shared/admin-data-state/admin-data-state.component';
import {
  AdminDashboardService,
  DashboardLowStock,
  DashboardRevenuePoint,
  DashboardServiceStat,
  DashboardSummary,
} from './admin-dashboard.service';

@Component({
  selector: 'app-admin-dashboard-page',
  standalone: true,
  imports: [AdminDataStateComponent],
  template: `
    <main class="dashboard-page">
      <header class="dashboard-heading">
        <div>
          <h1>Tổng quan hoạt động</h1>
        </div>
        <label class="dashboard-period">
          <span>Khoảng thời gian</span>
          <select [value]="preset()" (change)="changePreset($any($event.target).value)">
            <option value="today">Hôm nay</option>
            <option value="this_week">Tuần này</option>
            <option value="this_month">Tháng này</option>
            <option value="this_year">Năm nay</option>
          </select>
        </label>
      </header>

      @if (loading()) {
        <app-admin-data-state kind="loading" title="Đang tải tổng quan hoạt động" />
      } @else if (error()) {
        <app-admin-data-state kind="error" title="Không thể tải tổng quan hoạt động" [message]="error()" (retry)="load()" />
      } @else if (summary(); as data) {
        <section class="dashboard-kpis" aria-label="Chỉ số tổng quan">
          <article>
            <span>Doanh thu</span>
            <strong>{{ money(data.revenue.amount) }}</strong>
            <small>Sản phẩm và dịch vụ đã ghi nhận</small>
          </article>
          <article>
            <span>Đơn hàng</span>
            <strong>{{ data.orders }}</strong>
            <small>Tổng đơn trong kỳ</small>
          </article>
          <article>
            <span>Lịch hẹn</span>
            <strong>{{ data.appointments }}</strong>
            <small>Tổng lịch hẹn trong kỳ</small>
          </article>
          <article>
            <span>Khách hàng mới</span>
            <strong>{{ data.newCustomers }}</strong>
            <small>Tài khoản mới trong kỳ</small>
          </article>
          <article>
            <span>Cảnh báo tồn kho</span>
            <strong [class.dashboard-number--warning]="data.lowStockItems > 0">{{ data.lowStockItems }}</strong>
            <small>Mặt hàng còn từ 5 sản phẩm trở xuống</small>
          </article>
        </section>

        <div class="dashboard-grid">
          <section class="dashboard-card dashboard-card--wide">
            <header><div><h2>Doanh thu theo ngày</h2><p>Doanh thu đơn hàng đã giao hoặc hoàn tất.</p></div></header>
            @if (revenue().length) {
              <div class="dashboard-table-wrap">
                <table>
                  <thead><tr><th>Ngày</th><th class="right">Đơn hàng</th><th class="right">Doanh thu</th></tr></thead>
                  <tbody>
                    @for (row of revenue(); track row.date) {
                      <tr><td>{{ day(row.date) }}</td><td class="right">{{ row.orders }}</td><td class="right">{{ money(row.revenue) }}</td></tr>
                    }
                  </tbody>
                </table>
              </div>
            } @else {
              <app-admin-data-state kind="empty" title="Chưa có doanh thu" message="Chưa có giao dịch hoàn tất trong khoảng thời gian đã chọn." />
            }
          </section>

          <section class="dashboard-card">
            <header><div><h2>Dịch vụ được đặt nhiều</h2><p>Xếp hạng theo số lượt đặt lịch.</p></div></header>
            @if (services().length) {
              <ol class="service-ranking">
                @for (item of services().slice(0,5); track item.serviceId; let rank=$index) {
                  <li><span class="rank">{{rank+1}}</span><div><strong>{{item.name}}</strong><small>{{item.bookingsCount}} lượt đặt</small></div><b>{{money(item.estimatedRevenue)}}</b></li>
                }
              </ol>
            } @else {
              <app-admin-data-state kind="empty" title="Chưa có dữ liệu dịch vụ" message="Chưa có lượt đặt dịch vụ trong khoảng thời gian đã chọn." />
            }
          </section>

          <section class="dashboard-card">
            <header><div><h2>Cảnh báo tồn kho</h2><p>Các mặt hàng còn từ 5 sản phẩm trở xuống.</p></div></header>
            @if (lowStock().length) {
              <div class="stock-list">
                @for (row of lowStock().slice(0,6); track row.stockId) {
                  <div><div><strong>{{row.item?.name || 'Mặt hàng'}}</strong><small>{{row.item?.sku || '—'}} · {{row.branch?.name || 'Chưa xác định chi nhánh'}}</small></div><b>{{row.quantity}}</b></div>
                }
              </div>
            } @else {
              <app-admin-data-state kind="empty" title="Không có cảnh báo tồn kho" message="Các mặt hàng hiện đều trên ngưỡng cảnh báo." />
            }
          </section>
        </div>
      }
    </main>
  `,
  styleUrl: './admin-dashboard-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboardPageComponent {
  private readonly api=inject(AdminDashboardService);
  readonly preset=signal('this_month');
  readonly loading=signal(true);
  readonly error=signal('');
  readonly summary=signal<DashboardSummary|null>(null);
  readonly revenue=signal<DashboardRevenuePoint[]>([]);
  readonly lowStock=signal<DashboardLowStock[]>([]);
  readonly services=signal<DashboardServiceStat[]>([]);

  constructor(){this.load();}

  changePreset(value:string):void{this.preset.set(value);this.load();}

  load():void{
    this.loading.set(true);this.error.set('');
    forkJoin({
      summary:this.api.summary(this.preset()),
      revenue:this.api.revenue(this.preset()),
      lowStock:this.api.lowStock(),
      services:this.api.serviceStats(this.preset()),
    }).pipe(finalize(()=>this.loading.set(false))).subscribe({
      next:data=>{this.summary.set(data.summary);this.revenue.set(data.revenue);this.lowStock.set(data.lowStock);this.services.set(data.services);},
      error:()=>this.error.set('Đã có lỗi xảy ra khi tải số liệu tổng quan. Vui lòng thử lại.'),
    });
  }

  money(value:number):string{return new Intl.NumberFormat('vi-VN',{style:'currency',currency:'VND',maximumFractionDigits:0}).format(Number(value||0));}
  day(value:string):string{const d=new Date(value);return Number.isNaN(d.getTime())?value:new Intl.DateTimeFormat('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric'}).format(d);}
}
