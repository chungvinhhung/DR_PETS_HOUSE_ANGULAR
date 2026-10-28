import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { ApiClientService } from '../../../../core/services/api-client.service';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { adminErrorMessage } from '../../../../shared/services/admin-toast.service';
import {
  AppointmentView, normalizeAppointmentPage, statusLabel,
} from './admin-appointment-workflow.model';

@Component({
 selector: 'app-admin-appointments-page',
 standalone: true,
 imports: [RouterLink, AdminCatalogShellComponent],
 changeDetection: ChangeDetectionStrategy.OnPush,
 template: `
<app-admin-catalog-shell activeItem="appointments">
<main class="appointments">
  <header class="heading"><h1>Quản lý lịch hẹn</h1></header>
  <section class="panel filters" aria-label="Bộ lọc lịch hẹn">
    <label class="search">
      <img src="/assets/service-catalog/search.svg" width="16" height="16" alt="" />
      <span class="sr">Tìm lịch hẹn hoặc khách hàng</span>
      <input type="search" placeholder="Tìm khách hàng..." [value]="search()"
        (input)="search.set($any($event.target).value)" (keydown.enter)="lookup()">
    </label>
    <label class="sr" for="appointment-status-filter">Trạng thái lịch hẹn</label>
    <select id="appointment-status-filter" [value]="status()" (change)="changeStatus($any($event.target).value)">
      <option value="">Tất cả trạng thái</option>
      <option value="PENDING">Chờ xác nhận</option>
      <option value="PENDING_PAYMENT">Chờ thanh toán</option>
      <option value="CONFIRMED">Đã xác nhận</option>
      <option value="IN_PROGRESS">Đang thực hiện</option>
      <option value="COMPLETED">Hoàn tất</option>
      <option value="NO_SHOW">Không đến</option>
      <option value="CANCELLED">Đã hủy</option>
    </select>
    <label class="sr" for="appointment-date-filter">Khoảng thời gian</label>
    <select id="appointment-date-filter" disabled title="Bộ lọc thời gian chưa có hợp đồng API đã xác minh">
      <option>30 ngày qua</option>
    </select>
    <a routerLink="/admin/appointments/new" class="primary">+ Tạo lịch hẹn</a>
  </section>
  <section class="panel">
    @if (loading()) {
      <p class="message" role="status">Đang tải lịch hẹn...</p>
    } @else if (error()) {
      <div class="message" role="alert"><p>{{error()}}</p>
        <button type="button" class="secondary" (click)="load()">Thử lại</button></div>
    } @else {
      <div class="scroll">
        <table>
          <thead><tr>
            <th>Mã lịch</th><th>Ngày tạo</th><th>Giờ tạo</th>
            <th>Khách hàng</th><th>Dịch vụ</th><th>Trạng thái</th><th>Thao tác</th>
          </tr></thead>
          <tbody>
            @for (item of rows(); track item.id) {
              <tr>
                <td class="code">{{item.code}}</td>
                <td>{{formatDate(item.createdAt)}}</td>
                <td>{{formatClock(item.createdAt)}}</td>
                <td>{{item.customerName || '—'}}</td>
                <td>{{item.serviceNames.length ? item.serviceNames.join(', ') : '—'}}</td>
                <td><span class="badge" [attr.data-status]="statusColor(item)">
                  {{label(item)}}</span></td>
                <td>
                  <div class="actions">
                    <a [routerLink]="['/admin/appointments',item.id]" title="Xem / xử lý lịch hẹn" [attr.aria-label]="'Xem lịch hẹn '+item.code">
                      <img src="/assets/admin-staff/icon-edit.svg" width="16" height="16" alt="" />
                    </a>
                    @if (item.status!=='CANCELLED' && item.status!=='COMPLETED' && item.status!=='NO_SHOW') {
                      <a [routerLink]="['/admin/appointments',item.id]" [queryParams]="{action:'cancel'}"
                        title="Xem điều kiện yêu cầu hủy (không xóa dữ liệu)" [attr.aria-label]="'Xem điều kiện hủy '+item.code">
                        <img src="/assets/service-catalog/delete_outline.svg" width="16" height="16" alt="" />
                      </a>
                    } @else {
                      <span class="disabled-action" title="Lịch này không thể hủy">
                        <img src="/assets/service-catalog/delete_outline.svg" width="16" height="16" alt="" />
                      </span>
                    }
                  </div>
                </td>
              </tr>
            } @empty {
              <tr><td colspan="7" class="message">Không có lịch hẹn phù hợp.</td></tr>
            }
          </tbody>
        </table>
      </div>
      <footer>
        <span>Đang hiển thị {{rows().length}} trên tổng số {{total()}} lịch hẹn</span>
        <div class="pagination">
          <button type="button" [disabled]="page()===1" (click)="goto(page()-1)" aria-label="Trang trước">‹</button>
          <span>Trang {{page()}}</span>
          <button type="button" [disabled]="page()*limit>=total()" (click)="goto(page()+1)" aria-label="Trang sau">›</button>
        </div>
      </footer>
    }
  </section>
</main></app-admin-catalog-shell>`,
 styles:[`
 :host{display:block;color:#25324a}.appointments{padding:32px;max-width:1180px;margin:auto}
 .heading{margin:4px 0 26px}.heading h1{font-size:24px;font-weight:700;margin:0}
 .panel{border:1px solid #dce3ee;border-radius:11px;background:#fff;margin-bottom:18px;overflow:hidden}
 .filters{display:flex;align-items:center;gap:10px;padding:16px;flex-wrap:wrap}
 .search{display:flex;align-items:center;gap:9px;flex:1;min-width:220px;border:1px solid #cfd8e5;border-radius:8px;padding:0 11px}
 .search input{height:39px;width:100%;min-width:0;border:0;outline:0;font:inherit;font-size:13px}
 .filters select{font:inherit;font-size:13px;height:40px;min-width:145px;border:1px solid #d9e3ef;border-radius:8px;background:#fff;color:#303c50;padding:0 12px}
 .filters select:disabled{color:#334155;opacity:.75}
 .primary,.secondary{min-height:40px;border-radius:8px;padding:10px 16px;text-decoration:none;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;font-size:13px;font-weight:600}
 .primary{background:#003178;border:1px solid #003178;color:#fff}
 .secondary{border:1px solid #d5deeb;color:#0d47a1;background:#fff}
 .scroll{overflow-x:auto}
 table{width:100%;border-collapse:collapse;min-width:840px;font-size:13px;color:#41506a}
 th{height:44px;background:#f8fafc;color:#26364a;text-align:left;font-weight:650;padding:10px 16px;white-space:nowrap}
 td{border-top:1px solid #e2e8f0;height:65px;padding:11px 16px;line-height:1.4}
 td:nth-last-child(-n+2),th:nth-last-child(-n+2){text-align:center}
 .code{font-weight:600;color:#29354b}
 .badge{display:inline-flex;align-items:center;justify-content:center;padding:4px 10px;border-radius:99px;white-space:nowrap;background:#edf2f8;color:#556174;font-size:12px}
 .badge[data-status=warning]{background:#fff2dd;color:#bc790e}
 .badge[data-status=success]{background:#e5f5e6;color:#317744}
 .badge[data-status=danger]{background:#ffdddd;color:#b93131}
 .actions{display:flex;justify-content:center;gap:16px;align-items:center}
 .actions a,.disabled-action{display:inline-flex;align-items:center;justify-content:center;min-width:20px;min-height:28px}
 .actions a:hover{background:#eef5ff;border-radius:5px}
 .disabled-action{opacity:.3}
 .message{text-align:center;color:#718096;padding:26px}
 footer{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:15px 20px;color:#6c7c93;font-size:12px;border-top:1px solid #e2e8f0}
 .pagination{display:flex;align-items:center;gap:10px}
 .pagination button{background:#fff;border:1px solid #d8e1ed;border-radius:6px;cursor:pointer;padding:6px 12px;color:#0d47a1}
 .pagination button:disabled{opacity:.35;cursor:not-allowed}
 .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
 @media(max-width:700px){.appointments{padding:16px}.filters{align-items:stretch}.filters select,.search{flex:1}.primary{flex:1}footer{flex-wrap:wrap}}
 `]
})
export class AdminAppointmentsPageComponent {
  private readonly api=inject(ApiClientService);
  private readonly destroyRef=inject(DestroyRef);
  private requestVersion=0;
  readonly search=signal('');
  readonly status=signal('');
  readonly page=signal(1);
  readonly limit=7;
  readonly loading=signal(false);
  readonly error=signal('');
  readonly rows=signal<AppointmentView[]>([]);
  readonly total=signal(0);

  constructor(){this.load();}
  lookup():void{this.page.set(1);this.load();}
  changeStatus(value:string):void{this.status.set(value);this.page.set(1);this.load();}
  goto(page:number):void{
    if(page<1 || page>Math.max(1,Math.ceil(this.total()/this.limit)))return;
    this.page.set(page);this.load();
  }
  load():void{
    let params=new HttpParams().set('page',String(this.page())).set('limit',String(this.limit));
    if(this.search().trim())params=params.set('search',this.search().trim());
    if(this.status())params=params.set('status',this.status());
    const version=++this.requestVersion;
    this.loading.set(true);this.error.set('');
    this.api.get<unknown>('/appointments',{params}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:raw=>{
        if(version!==this.requestVersion)return;
        try{
          const data=normalizeAppointmentPage(raw);
          this.rows.set(data.items);this.total.set(data.total);this.loading.set(false);
        }catch(err){
          this.rows.set([]);this.total.set(0);
          this.error.set(err instanceof Error?err.message:'Dữ liệu lịch hẹn không đúng định dạng.');
          this.loading.set(false);
        }
      },
      error:err=>{
        if(version!==this.requestVersion)return;
        this.rows.set([]);this.total.set(0);
        this.error.set(adminErrorMessage(err,'Chưa tải được lịch hẹn từ BE.'));
        this.loading.set(false);
      },
    });
  }
  label(row:AppointmentView):string{return statusLabel(row.status,row.rawStatus);}
  statusColor(row:AppointmentView):string{
    return ['CANCELLED','NO_SHOW'].includes(row.status)?'danger':
      ['CONFIRMED','COMPLETED'].includes(row.status)?'success':
      (row.status==='PENDING'||row.status==='PENDING_PAYMENT')?'warning':'neutral';
  }
  formatDate(value:string|null):string{
    if(!value)return '—';const d=new Date(value);
    return Number.isNaN(d.getTime())?'—':
      new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric'}).format(d);
  }
  formatClock(value:string|null):string{
    if(!value)return '—';const d=new Date(value);
    return Number.isNaN(d.getTime())?'—':
      new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).format(d);
  }
}
