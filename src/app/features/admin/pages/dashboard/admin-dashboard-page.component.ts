import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
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
          <p>Số liệu được tổng hợp từ hoạt động thực tế trong hệ thống.</p>
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
  styles: [`
    :host{display:block;min-width:0}
    .dashboard-page{box-sizing:border-box;width:100%;padding:30px 32px 44px;color:#202e45;font:400 13px/1.5 Roboto,Arial,sans-serif}
    .dashboard-heading{display:flex;align-items:flex-end;justify-content:space-between;gap:20px;margin-bottom:22px}
    .dashboard-heading h1{margin:0;color:#1d2a42;font-size:28px;line-height:34px;font-weight:700}
    .dashboard-heading p{margin:5px 0 0;color:#718096;font-size:12px}
    .dashboard-period{display:flex;flex-direction:column;gap:5px;color:#60748d;font-size:11px;font-weight:500}
    .dashboard-period select{width:170px;height:40px;padding:0 36px 0 12px;border:1px solid #dce5f0;border-radius:8px;appearance:none;background:#fff url('/assets/admin-product/expand_more.svg') no-repeat right 10px center;background-size:18px;color:#26364a;font:400 13px Roboto,Arial,sans-serif}
    .dashboard-kpis{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin-bottom:18px}
    .dashboard-kpis article{min-width:0;min-height:112px;padding:15px 16px;border:1px solid #e2e8f0;border-radius:10px;background:#fff}
    .dashboard-kpis span{display:block;color:#64748b;font-size:12px;font-weight:500}
    .dashboard-kpis strong{display:block;margin-top:7px;color:#0d47a1;font-size:23px;line-height:30px;font-weight:700;overflow-wrap:anywhere}
    .dashboard-kpis small{display:block;margin-top:4px;color:#8a98aa;font-size:10.5px}
    .dashboard-kpis .dashboard-number--warning{color:#c36a00}
    .dashboard-grid{display:grid;grid-template-columns:minmax(0,1.6fr) minmax(300px,.8fr);gap:16px}
    .dashboard-card{min-width:0;border:1px solid #e2e8f0;border-radius:10px;background:#fff;overflow:hidden}
    .dashboard-card--wide{grid-row:span 2}
    .dashboard-card>header{padding:15px 17px;border-bottom:1px solid #e2e8f0}
    .dashboard-card h2{margin:0;color:#26364a;font-size:15px;line-height:22px;font-weight:600}
    .dashboard-card header p{margin:3px 0 0;color:#718096;font-size:11px}
    .dashboard-table-wrap{overflow-x:auto}
    table{width:100%;border-collapse:collapse;table-layout:fixed}
    th{height:42px;padding:0 17px;background:#f8fafc;color:#536783;text-align:left;font-size:11px;font-weight:600}
    td{height:52px;padding:8px 17px;border-top:1px solid #edf1f5;color:#344760;font-size:12px}
    .right{text-align:right}
    .service-ranking{list-style:none;margin:0;padding:6px 16px}
    .service-ranking li{display:grid;grid-template-columns:30px minmax(0,1fr) auto;align-items:center;gap:9px;min-height:58px;border-bottom:1px solid #edf1f5}
    .service-ranking li:last-child{border-bottom:0}
    .rank{display:grid;width:24px;height:24px;place-items:center;border-radius:50%;background:#eef4fb;color:#0d47a1;font-size:11px;font-weight:700}
    .service-ranking strong,.stock-list strong{display:block;color:#26364a;font-size:12px;font-weight:600}
    .service-ranking small,.stock-list small{display:block;margin-top:2px;color:#718096;font-size:10.5px}
    .service-ranking b{color:#536783;font-size:11px;font-weight:600;white-space:nowrap}
    .stock-list{padding:6px 16px}
    .stock-list>div{display:flex;align-items:center;justify-content:space-between;gap:12px;min-height:58px;border-bottom:1px solid #edf1f5}
    .stock-list>div:last-child{border-bottom:0}
    .stock-list>div>div{min-width:0}
    .stock-list b{display:grid;min-width:32px;height:27px;place-items:center;border-radius:7px;background:#fff3df;color:#b96800;font-size:12px}
    @media(max-width:1200px){.dashboard-kpis{grid-template-columns:repeat(3,minmax(0,1fr))}.dashboard-grid{grid-template-columns:1fr}.dashboard-card--wide{grid-row:auto}}
    @media(max-width:700px){.dashboard-page{padding:20px 14px 32px}.dashboard-heading{align-items:flex-start;flex-direction:column}.dashboard-period select{width:100%}.dashboard-kpis{grid-template-columns:1fr 1fr}}
    @media(max-width:460px){.dashboard-kpis{grid-template-columns:1fr}}
  `],
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
