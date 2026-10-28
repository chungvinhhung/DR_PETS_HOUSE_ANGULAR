import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
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
  <section class="panel filters web2-filterbar" aria-label="Bộ lọc lịch hẹn">
    <label class="search web2-management-search">
      <img src="/assets/service-catalog/search.svg" width="16" height="16" alt="" />
      <span class="sr">Tìm lịch hẹn hoặc khách hàng</span>
      <input type="search" placeholder="Tìm khách hàng..." [value]="search()"
        (input)="onSearch($any($event.target).value)" (keydown.enter)="lookup()">
    </label>
    <div class="filter-actions web2-management-actions">
      <label class="filter-control web2-management-control">
        <span class="sr" id="appointment-status-label">Trạng thái lịch hẹn</span>
        <select aria-labelledby="appointment-status-label" id="appointment-status-filter" [value]="status()" (change)="changeStatus($any($event.target).value)">
          <option value="">Tất cả trạng thái</option>
          <option value="PENDING_CONFIRMATION">Chờ xác nhận</option>
          <option value="PENDING_PAYMENT">Chờ thanh toán</option>
          <option value="CONFIRMED">Đã xác nhận</option>
          <option value="IN_PROGRESS">Đang thực hiện</option>
          <option value="COMPLETED">Hoàn tất</option>
          <option value="NO_SHOW">Không đến</option>
          <option value="CANCELLED">Đã hủy</option>
        </select>
      </label>
      <label class="filter-control web2-management-control">
        <span class="sr" id="appointment-date-label">Khoảng thời gian</span>
        <select id="appointment-date-filter" aria-labelledby="appointment-date-label"
          [value]="dateRange()" (change)="changeDateRange($any($event.target).value)">
          <option value="30">30 ngày qua</option>
          <option value="90">90 ngày qua</option>
          <option value="all">Tất cả thời gian</option>
        </select>
      </label>
      <a routerLink="/admin/appointments/new" class="primary web2-add-button">
        <span class="web2-add-icon" aria-hidden="true">+</span>Tạo lịch hẹn
      </a>
    </div>
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
      <footer class="list-footer">
        <p>Đang hiển thị {{rows().length}} trên tổng số {{total()}} lịch hẹn
          @if(partial()){<span class="data-scope"> (trong 100 lịch hẹn đã tải)</span>}
        </p>
        @if (pageCount() > 1) {
          <nav class="pagination" aria-label="Phân trang lịch hẹn">
            <button type="button" [disabled]="page()===1" (click)="goto(page()-1)" aria-label="Trang trước">‹</button>
            @if(pageNumbers()[0] > 1) {
              <button type="button" (click)="goto(1)">1</button>
              @if(pageNumbers()[0] > 2) {<span aria-hidden="true">…</span>}
            }
            @for(n of pageNumbers();track n) {
              <button type="button" [attr.aria-current]="page()===n?'page':null"
                [class.selected]="page()===n" (click)="goto(n)">{{n}}</button>
            }
            @if(pageNumbers()[pageNumbers().length-1] < pageCount()) {
              @if(pageNumbers()[pageNumbers().length-1] < pageCount()-1){<span aria-hidden="true">…</span>}
              <button type="button" (click)="goto(pageCount())">{{pageCount()}}</button>
            }
            <button type="button" [disabled]="page()===pageCount()" (click)="goto(page()+1)" aria-label="Trang sau">›</button>
          </nav>
        }
      </footer>
    }
  </section>
</main></app-admin-catalog-shell>`,
 styles:[`
 :host{display:block;font-family:Roboto,Arial,sans-serif;color:#26364a}
 .appointments{box-sizing:border-box;width:100%;min-width:0;padding:32px}
 .heading{margin:0 0 24px}.heading h1{font-size:28px;line-height:34px;font-weight:700;margin:0;color:#1d2a42}
 .panel{border:1px solid #dee5f0;border-radius:10px;background:#fff;margin-bottom:18px;overflow:hidden}
 .filters{margin-bottom:18px}.search{min-width:0}.search input{color:#26364a;font-size:13px}
 .filter-actions{display:flex;align-items:center;gap:12px}.filter-control{width:170px;height:40px}
 .filters .filter-control select{box-sizing:border-box;appearance:none;-webkit-appearance:none;width:100%;height:40px;padding:0 38px 0 12px;
   border:1px solid #dee5f0;border-radius:8px;background:#fff url('/assets/admin-product/expand_more.svg') no-repeat right 11px center;
   background-size:18px 18px;color:#26364a;font:400 13px Roboto,Arial,sans-serif;cursor:pointer}
 .primary{background:#0d47a1;border:1px solid #0d47a1;color:#fff;text-decoration:none;font-weight:600}
 .primary:hover{background:#083a89}.secondary{padding:9px 15px;border:1px solid #d5deeb;border-radius:8px;color:#0d47a1;background:#fff;cursor:pointer}
 .scroll{overflow-x:auto}table{width:100%;border-collapse:collapse;table-layout:fixed;min-width:800px;font-size:12px;color:#41506a}
 th{height:44px;background:#f8fafc;color:#26364a;text-align:left;font-weight:650;padding:10px 12px;white-space:nowrap}
 td{border-top:1px solid #e2e8f0;height:58px;padding:11px 12px;line-height:1.5;overflow-wrap:anywhere}
 th:nth-child(1){width:12%}th:nth-child(2){width:13%}th:nth-child(3){width:13%}
 th:nth-child(4){width:18%}th:nth-child(5){width:20%}th:nth-child(6){width:15%}th:nth-child(7){width:9%}
 td:nth-last-child(-n+2),th:nth-last-child(-n+2){text-align:center}.code{font-weight:600;color:#29354b}
 .badge{display:inline-flex;align-items:center;justify-content:center;padding:4px 9px;border-radius:99px;white-space:nowrap;background:#edf2f8;color:#556174;font-size:12px}
 .badge[data-status=warning]{background:#fff2dd;color:#bc790e}.badge[data-status=success]{background:#e5f5e6;color:#317744}
 .badge[data-status=danger]{background:#ffdddd;color:#b93131}.actions{display:flex;justify-content:center;gap:12px;align-items:center}
 .actions a,.disabled-action{display:inline-flex;align-items:center;justify-content:center;width:27px;height:27px}
 .actions a:hover{background:#eef5ff;border-radius:5px}.disabled-action{opacity:.3}.message{text-align:center;color:#718096;padding:26px}
 .list-footer{min-height:60px;display:flex;justify-content:space-between;gap:12px;align-items:center;padding:8px 12px;color:#6c7c93;font-size:12px;border-top:1px solid #e2e8f0}
 .list-footer p{margin:0;font-size:12px}.data-scope{color:#64748b}
 .pagination{display:flex;align-items:center;gap:6px}
 .pagination button{height:32px;min-width:32px;background:#fff;border:1px solid #d8e1ed;border-radius:6px;cursor:pointer;color:#0d47a1;font:500 12px Roboto,Arial,sans-serif}
 .pagination button:hover:not(:disabled){background:#eef5ff}.pagination button.selected{background:#0d47a1;color:#fff;border-color:#0d47a1}
 .pagination button:disabled{opacity:.4;cursor:not-allowed}
 .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
 @media(max-width:1120px){.filters{flex-wrap:wrap}.filter-actions{flex-wrap:wrap;justify-content:flex-start;width:100%}}
 @media(max-width:650px){.appointments{padding:16px}.filter-control{flex:1;min-width:130px}.list-footer{flex-wrap:wrap}}
 `]
})
export class AdminAppointmentsPageComponent {
  private readonly api=inject(ApiClientService);
  private readonly destroyRef=inject(DestroyRef);
  private requestVersion=0;
  readonly search=signal('');
  readonly status=signal('');
  readonly dateRange=signal('30');
  readonly page=signal(1);
  readonly limit=7;
  readonly loading=signal(false);
  readonly error=signal('');
  private readonly fetchedRows=signal<AppointmentView[]>([]);
  readonly partial=computed(()=>this.fetchedRows().length>=100);
  readonly filteredRows=computed(()=>{
    const search=this.search().trim().toLocaleLowerCase('vi');
    const status=this.status();
    const days=this.dateRange();
    const cutoff=days==='all'?null:Date.now()-Number(days)*24*60*60*1000;
    return this.fetchedRows().filter(row=>
      (cutoff===null || (row.createdAt!==null && new Date(row.createdAt).getTime()>=cutoff)) &&
      (!status || row.rawStatus===status) &&
      (!search || [row.code,row.customerName,row.customerPhone,row.id,...row.serviceNames]
        .some(t=>t.toLocaleLowerCase('vi').includes(search))));
  });
  readonly total=computed(()=>this.filteredRows().length);
  readonly pageCount=computed(()=>Math.max(1,Math.ceil(this.total()/this.limit)));
  readonly pageNumbers=computed(()=>{
    const count=this.pageCount();
    const start=Math.max(1,Math.min(this.page()-2,count-4));
    return Array.from({length:Math.min(5,count)},(_,i)=>start+i);
  });
  readonly rows=computed(()=>this.filteredRows().slice((this.page()-1)*this.limit,this.page()*this.limit));

  constructor(){this.load();}
  onSearch(value:string):void{this.search.set(value);this.page.set(1);}
  lookup():void{this.page.set(1);}
  changeStatus(value:string):void{this.status.set(value);this.page.set(1);}
  changeDateRange(value:string):void{this.dateRange.set(value);this.page.set(1);}
  goto(page:number):void{
    if(page<1 || page>Math.max(1,Math.ceil(this.total()/this.limit)))return;
    this.page.set(page);
  }
  load():void{
    // BE foundation-v6 lists at most 100 records and ignores page/search.
    // Use local paging/search for fetched subset; disclose when cap is reached.
    const params=new HttpParams().set('limit','100');
    const version=++this.requestVersion;
    this.loading.set(true);this.error.set('');
    this.api.get<unknown>('/appointments',{params}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:raw=>{
        if(version!==this.requestVersion)return;
        try{
          const data=normalizeAppointmentPage(raw);
          this.fetchedRows.set(data.items);this.loading.set(false);
        }catch(err){
          this.fetchedRows.set([]);
          this.error.set('Chưa thể hiển thị danh sách lịch hẹn. Vui lòng thử lại.');
          this.loading.set(false);
        }
      },
      error:err=>{
        if(version!==this.requestVersion)return;
        this.fetchedRows.set([]);
        this.error.set(adminErrorMessage(err,'Chưa tải được danh sách lịch hẹn. Vui lòng thử lại.'));
        this.loading.set(false);
      },
    });
  }
  label(row:AppointmentView):string{return statusLabel(row.status,row.rawStatus);}
  statusColor(row:AppointmentView):string{
    return ['CANCELLED','NO_SHOW'].includes(row.status)?'danger':
      ['CONFIRMED','COMPLETED'].includes(row.status)?'success':
      (['PENDING','PENDING_CONFIRMATION','PENDING_PAYMENT'].includes(row.status))?'warning':'neutral';
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
