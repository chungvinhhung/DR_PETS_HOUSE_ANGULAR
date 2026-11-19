import { adminPageWindowWithEdges } from '../../../../shared/utils/admin-table-pagination';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink, ActivatedRoute } from '@angular/router';

import { ApiClientService } from '../../../../core/services/api-client.service';
import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { AdminStaffApiService } from '../../staff/services/admin-staff-api.service';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminDataStateComponent } from '../../../../shared/admin-data-state/admin-data-state.component';
import { adminErrorMessage } from '../../../../shared/services/admin-toast.service';
import {
  AppointmentView, normalizeAppointmentPage, statusLabel,
} from './admin-appointment-workflow.model';

@Component({
 selector: 'app-admin-appointments-page',
 standalone: true,
 imports: [RouterLink, AdminCatalogShellComponent, AdminDataStateComponent],
 changeDetection: ChangeDetectionStrategy.OnPush,
 template: `
<app-admin-catalog-shell activeItem="appointments">
<main class="appointments">
  <header class="heading"><h1>Quản lý lịch hẹn</h1></header>
  @if (dashboardFilter(); as filter) {
    <div class="dashboard-scope">
      <span>Đang xem lịch hẹn tạo trong kỳ {{filter.from}} – {{filter.to}}
        @if (filter.status) { · {{filter.status}} }
      </span>
      <a routerLink="/admin/appointments">Xóa lọc Dashboard</a>
    </div>
  }
  <section class="appointments__kpis" aria-label="Thống kê lịch hẹn trong dữ liệu đã tải">
    <article class="appointments__kpi" data-kpi-tone="neutral">
      <span>Tổng lịch hẹn</span>
      <strong>{{ loading() || error() ? '—' : kpis().total }}</strong>
    </article>
    <article class="appointments__kpi" data-kpi-tone="warning">
      <span>Chờ thanh toán</span>
      <strong class="appointments__kpi--blue">{{ loading() || error() ? '—' : kpis().pendingPayment }}</strong>
    </article>
    <article class="appointments__kpi" data-kpi-tone="info">
      <span>Đang thực hiện</span>
      <strong>{{ loading() || error() ? '—' : kpis().inProgress }}</strong>
    </article>
    <article class="appointments__kpi" data-kpi-tone="success">
      <span>Hoàn tất</span>
      <strong>{{ loading() || error() ? '—' : kpis().completed }}</strong>
    </article>
  </section>
  <section class="panel filters web2-filterbar" aria-label="Bộ lọc lịch hẹn">
    <label class="search web2-management-search">
      <img src="/assets/service-catalog/search.svg" width="16" height="16" alt="" />
      <span class="sr">Tìm lịch hẹn hoặc khách hàng</span>
      <input type="search" placeholder="Tìm theo số điện thoại khách hàng, mã lịch hẹn..." [value]="search()"
        (input)="onSearch($any($event.target).value)" (keydown.enter)="lookup()">
    </label>
    <div class="filter-actions web2-management-actions">
      <label class="filter-control web2-management-control">
        <span class="sr" id="appointment-status-label">Trạng thái lịch hẹn</span>
        <select aria-labelledby="appointment-status-label" id="appointment-status-filter" [value]="status()" (change)="changeStatus($any($event.target).value)">
          <option value="">Tất cả trạng thái</option>
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
          <option value="all">Tất cả thời gian</option>
          <option value="30">30 ngày qua</option>
          <option value="90">90 ngày qua</option>
        </select>
      </label>
      @if (canCreateAppointment()) {
        <a routerLink="/admin/appointments/new" class="primary web2-add-button">
          <span class="web2-add-icon" aria-hidden="true">+</span>Tạo lịch hẹn
        </a>
      }
    </div>
  </section>
  <section class="panel">
    @if (loading()) {
      <app-admin-data-state kind="loading" title="Đang tải danh sách lịch hẹn" />
    } @else if (error()) {
      <app-admin-data-state kind="error" title="Không thể tải danh sách lịch hẹn" [message]="error()" (retry)="load()" />
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
                <td class="code">#{{displayCode(item.code)}}</td>
                <td>{{formatDate(item.createdAt)}}</td>
                <td>{{formatClock(item.createdAt)}}</td>
                <td>{{item.customerName || '—'}}</td>
                <td>{{item.serviceNames.length ? item.serviceNames.join(', ') : '—'}}</td>
                <td><span class="badge" [attr.data-status]="statusColor(item)">
                  {{label(item)}}</span></td>
                <td>
                  <div class="actions">
                    <a [routerLink]="['/admin/appointments',item.id]" title="Xem chi tiết"
                      [attr.aria-label]="'Xem chi tiết lịch hẹn '+item.code">
                      <img src="/assets/admin-branch/figma-eye.svg" width="20" height="20" alt="" />
                    </a>
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
          <nav class="pagination web2-admin-pagination-strip" aria-label="Phân trang lịch hẹn">
            <button type="button" [disabled]="page()===1" (click)="goto(page()-1)" aria-label="Trang trước">‹</button>
            @for (n of pageNumbers(); track n === '…' ? 'gap-' + $index : 'page-' + n) {
              @if(n==='…'){<span aria-hidden="true">…</span>}
              @else {
                <button type="button" [attr.aria-current]="page()===n?'page':null"
                  [class.selected]="page()===n" (click)="goto(n)">{{n}}</button>
              }
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
 .heading{display:flex;align-items:center;min-height:36px;margin:0 0 20px}.heading h1{font-size:28px;line-height:34px;font-weight:700;margin:0;color:#1d2a42}
 .panel{border:1px solid #dee5f0;border-radius:10px;background:#fff;margin-bottom:18px;overflow:hidden}
 .filters{margin-bottom:20px;min-height:70px!important;padding:14px!important;border-radius:10px!important}.search{min-width:0}.search input{color:#26364a;font-size:13px}
 .filters .search{flex:0 1 430px!important;width:430px!important;max-width:430px!important;height:40px!important;min-height:40px!important}
 .filter-actions{display:flex;align-items:center;gap:12px}.filter-control{width:170px;height:40px}
 .filters .filter-control{height:40px!important;min-height:40px!important}
 .filters .filter-control:nth-child(2){width:170px!important}
 .filters .web2-add-button{height:40px!important;min-height:40px!important;padding:0 15px!important}
 .filters .filter-control select{box-sizing:border-box;appearance:none;-webkit-appearance:none;width:100%;height:40px;padding:0 38px 0 12px;
   border:1px solid #dee5f0;border-radius:8px;background:#fff url('/assets/admin-product/icon-chevron-down.svg') no-repeat right 14px center;
   background-size:18px 18px;color:#26364a;font:400 13px Roboto,Arial,sans-serif;cursor:pointer}
 .primary{background:#0d47a1;border:1px solid #0d47a1;color:#fff;text-decoration:none;font-weight:600}
 .primary:hover{background:#083a89}.secondary{padding:9px 15px;border:1px solid #d5deeb;border-radius:8px;color:#0d47a1;background:#fff;cursor:pointer}
 .scroll{overflow-x:auto}table{width:100%;border-collapse:collapse;table-layout:fixed;min-width:800px;font-size:12px;color:#41506a}
 th{height:44px;background:#f8fafc;color:#26364a;text-align:left;font-weight:650;padding:10px 12px;white-space:nowrap}
 td{border-top:1px solid #e2e8f0;height:76px;padding:12px;line-height:1.5;overflow-wrap:anywhere}
 /* Mã lịch 14% + five equally spaced fields (5 × 15.4%) + Thao tác 9% = 100%.
    Date, time, customer, service and status have equal column widths. */
 th:nth-child(1){width:14%}
 th:nth-child(2),th:nth-child(3),th:nth-child(4),th:nth-child(5),th:nth-child(6){width:15.4%}
 th:nth-child(7){width:9%}
 /* Date, time and customer are center-aligned on equal-width columns.
    Keep service names left-aligned, but inset that column's heading and
    values together so their visible starting edge does not crowd Customer. */
 .scroll table :is(th,td):not(:nth-child(1)):not(:nth-child(5)){text-align:center}
 .scroll table :is(th,td):nth-child(1){text-align:left}
 .scroll table :is(th,td):nth-child(5){
   text-align:left;
   padding-left:clamp(28px,4.2vw,60px);
 }
 .scroll table :is(th,td){vertical-align:middle}
 .code{font-weight:600;color:#29354b}
 .badge{display:inline-flex;align-items:center;justify-content:center;padding:4px 9px;border-radius:99px;white-space:nowrap;background:#edf2f8;color:#556174;font-size:12px}
 .badge[data-status=warning]{background:#fff2dd;color:#bc790e}.badge[data-status=success]{background:#e5f5e6;color:#317744}
 .badge[data-status=info]{background:#e3f3ff;color:#276c9b}.badge[data-status=danger]{background:#ffdddd;color:#b93131}.actions{display:flex;justify-content:center;gap:12px;align-items:center}
 .actions a{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px}
 .actions a img{display:block;width:20px;height:20px}
 .actions a:hover{background:#eef5ff}.message{text-align:center;color:#718096;padding:26px}
 .list-footer{min-height:60px;display:flex;justify-content:space-between;gap:12px;align-items:center;padding:8px 12px;color:#6c7c93;font-size:12px;border-top:1px solid #e2e8f0}
 .list-footer p{margin:0;font-size:12px}.data-scope{color:#64748b}
 /* Product Management pagination: joined 44px rectangular cells and
    light-blue active number, never disconnected round blue buttons. */
 .pagination{display:flex;align-items:stretch;gap:0;max-width:100%;overflow-x:auto;
   border:1px solid #e2e8f0;border-radius:8px;scrollbar-width:thin}
 .pagination :is(button,span){box-sizing:border-box;display:grid;place-items:center;
   flex:0 0 48px;width:48px;min-width:48px;height:44px;padding:0;
   border:0;border-right:1px solid #e2e8f0;border-radius:0;
   background:#fff;color:#475569;font:400 14px/20px Roboto,Arial,sans-serif}
 .pagination :is(button,span):last-child{border-right:0}
 .pagination button:first-child,.pagination button:last-child{flex-basis:44px;width:44px;min-width:44px}.pagination button{cursor:pointer}
 .pagination button:hover:not(:disabled):not(.selected){background:#f1f5f9}
 .pagination button.selected{background:#e5f6fd;color:#0d47a1;
   box-shadow:inset 0 0 0 1px #0d47a1;font-weight:700}
 .pagination button:disabled{color:#bac8d9;cursor:not-allowed}
 .pagination button:focus-visible{outline:2px solid #0d47a1;outline-offset:-3px}
 .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
 @media(max-width:1120px){.filters{flex-wrap:wrap}.filter-actions{flex-wrap:wrap;justify-content:flex-start;width:100%}}
 @media(max-width:1050px){.scroll table :is(th,td):nth-child(5){padding-left:32px}}
 .dashboard-scope{display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin:0 0 12px;padding:10px 14px;border:1px solid #d8e6f6;border-radius:9px;background:#f5f9ff;font-size:12px;color:#3d5978}
 .dashboard-scope a{color:#0d47a1;font-weight:650;text-decoration:none}
 .dashboard-scope a:hover{text-decoration:underline}
 @media(max-width:650px){.appointments{padding:16px}.filter-control{flex:1;min-width:130px}.list-footer{flex-wrap:wrap}
   .pagination{margin-left:auto}}
 `]
})
export class AdminAppointmentsPageComponent {
  private readonly api=inject(ApiClientService);
  private readonly route=inject(ActivatedRoute);
  private readonly session=inject(AuthSessionService);
  private readonly staffApi=inject(AdminStaffApiService);
  private readonly destroyRef=inject(DestroyRef);
  private requestVersion=0;
  readonly search=signal('');
  readonly status=signal('');
  readonly dashboardFilter=signal<{from:string;to:string;status?:string;branchId?:string}|null>(null);
  readonly dateRange=signal('all');
  readonly page=signal(1);
  readonly limit=7;
  readonly loading=signal(false);
  readonly error=signal('');
  private readonly fetchedRows=signal<AppointmentView[]>([]);
  readonly partial=computed(()=>this.fetchedRows().length>=100);
  readonly canCreateAppointment=computed(()=>{
    const user=this.session.user();
    return user?.systemRole==='ADMIN' || user?.systemRole==='MANAGER' ||
      (user?.systemRole==='STAFF' && user.staffSubRole==='RECEPTIONIST');
  });
  private readonly scopedRows=computed(()=>{
    const user=this.session.user();
    if(!user || user.systemRole==='ADMIN') return this.fetchedRows();
    if(user.systemRole==='MANAGER' || (user.systemRole==='STAFF' && user.staffSubRole==='RECEPTIONIST')){
      const scope=user.branchScope ?? [];
      return this.fetchedRows().filter(row=>scope.includes(row.branchId));
    }
    if (user.systemRole==='STAFF') {
      // M15: Vet, Nurse and Groomer may only see assigned appointments.
      // assignedStaffId stores StaffProfile ID, not User ID.
      const ownProfile=this.staffApi.staff().find(staff=>staff.userId===user.id);
      if(!ownProfile) return []; // Fail closed until BE supplies own staff profile.
      return this.fetchedRows().filter(row =>
        row.reviewerStaffId===ownProfile.id ||
        row.serviceSegments.some(segment=>segment.assignedStaffId===ownProfile.id));
    }
    return [];
  });
  readonly kpis=computed(()=>{
    const appointments=this.scopedRows();
    return {
      total: appointments.length,
      pendingPayment: appointments.filter(row=>row.status==='PENDING_PAYMENT').length,
      inProgress: appointments.filter(row=>row.status==='IN_PROGRESS').length,
      completed: appointments.filter(row=>row.status==='COMPLETED').length,
    };
  });
  readonly filteredRows=computed(()=>{
    const search=this.search().trim().toLocaleLowerCase('vi');
    const status=this.status();
    const days=this.dateRange();
    const cutoff=days==='all'?null:Date.now()-Number(days)*24*60*60*1000;
    return this.scopedRows().filter(row=>
      (cutoff===null || (row.createdAt!==null && new Date(row.createdAt).getTime()>=cutoff)) &&
      (!status || row.rawStatus===status) &&
      (!search || [row.code,row.customerName,row.customerPhone,row.id,...row.serviceNames]
        .some(t=>t.toLocaleLowerCase('vi').includes(search))));
  });
  readonly total=computed(()=>this.filteredRows().length);
  readonly pageCount=computed(()=>Math.max(1,Math.ceil(this.total()/this.limit)));
  readonly pageNumbers=computed(()=>adminPageWindowWithEdges(this.page(),this.pageCount()));
  readonly rows=computed(()=>this.filteredRows().slice((this.page()-1)*this.limit,this.page()*this.limit));

  constructor(){
    if (this.session.user()?.systemRole==='STAFF' &&
        this.session.user()?.staffSubRole!=='RECEPTIONIST') this.staffApi.loadRoster();
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(query=>{
      const from=query.get('from')||'';
      const to=query.get('to')||'';
      const status=query.get('status')||'';
      const branchId=query.get('branchId')||'';
      const value=/^\d{4}-\d{2}-\d{2}$/.test(from) && /^\d{4}-\d{2}-\d{2}$/.test(to) && from<=to
        ? {from,to,...(status?{status}:{}),...(branchId?{branchId}:{})}
        : null;
      this.dashboardFilter.set(value);
      this.status.set(value?.status||'');
      this.dateRange.set('all');
      this.page.set(1);
      this.load();
    });
  }
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
    const filter=this.dashboardFilter();
    let params=new HttpParams().set('limit','100');
    if(filter){
      params=params.set('from',filter.from).set('to',filter.to).set('dateField','createdAt');
      if(filter.status)params=params.set('status',filter.status);
      if(filter.branchId)params=params.set('branchId',filter.branchId);
    }
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
  displayCode(value:string):string{return value.replace(/^#/,'');}
  label(row:AppointmentView):string{return statusLabel(row.status,row.rawStatus);}
  statusColor(row:AppointmentView):string{
    return ['CANCELLED','NO_SHOW'].includes(row.status)?'danger':
      ['CONFIRMED','COMPLETED'].includes(row.status)?'success':
      row.status==='IN_PROGRESS'?'info':
      (['PENDING','PENDING_PAYMENT'].includes(row.status))?'warning':'neutral';
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
