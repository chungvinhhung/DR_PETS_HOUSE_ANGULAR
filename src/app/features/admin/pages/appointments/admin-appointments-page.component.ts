import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ApiClientService } from '../../../../core/services/api-client.service';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminToastService, adminErrorMessage } from '../../../../shared/services/admin-toast.service';

interface AppointmentRow {
  id: string;
  code?: string;
  customerName?: string;
  customer?: { fullName?: string; phone?: string };
  petName?: string;
  serviceName?: string;
  branchName?: string;
  startAt?: string;
  appointmentDate?: string;
  status?: string;
}
interface AppointmentPage {
  items: AppointmentRow[];
  total?: number;
  totalItems?: number;
}
@Component({
 selector: 'app-admin-appointments-page',
 standalone: true,
 imports: [RouterLink, AdminCatalogShellComponent],
 changeDetection: ChangeDetectionStrategy.OnPush,
 template: `
<app-admin-catalog-shell activeItem="appointments">
<main class="appointments">
 <nav class="breadcrumbs"><span>Dịch vụ</span><span>›</span><strong>Lịch hẹn</strong></nav>
 <div class="heading"><h1>Lịch hẹn</h1><a routerLink="/admin/appointments/new" class="primary">+ Tạo lịch hẹn</a></div>
 <section class="panel filters">
  <label class="search"><span class="sr">Tìm lịch hẹn</span><input type="search" placeholder="Tìm mã lịch hẹn hoặc khách hàng..." [value]="search()" (input)="setSearch($any($event.target).value)" (keydown.enter)="load()" /></label>
  <label><span class="sr">Trạng thái</span><select [value]="status()" (change)="setStatus($any($event.target).value)"><option value="">Tất cả trạng thái</option><option value="PENDING">Chờ xác nhận</option><option value="CONFIRMED">Đã xác nhận</option><option value="COMPLETED">Hoàn tất</option><option value="CANCELLED">Đã hủy</option></select></label>
  <button type="button" class="secondary" (click)="load()">Tra cứu</button>
  <button type="button" class="secondary" (click)="clear()">Xóa lọc</button>
 </section>
 <section class="panel">
  @if (loading()) { <p class="message" role="status">Đang tải danh sách lịch hẹn...</p> }
  @else if (error()) { <div class="message" role="alert"><p>{{ error() }}</p><button class="secondary" type="button" (click)="load()">Thử lại</button></div> }
  @else {
   <div class="scroll"><table>
    <thead><tr><th>Mã lịch hẹn</th><th>Khách hàng</th><th>Thú cưng</th><th>Dịch vụ</th><th>Chi nhánh</th><th>Ngày giờ hẹn</th><th>Trạng thái</th><th>Thao tác</th></tr></thead>
    <tbody>
     @for (item of rows(); track item.id) {
       <tr><td>{{ item.code || item.id }}</td><td>{{ item.customerName || item.customer?.fullName || '—' }}</td>
       <td>{{ item.petName || '—' }}</td><td>{{ item.serviceName || '—' }}</td>
       <td>{{ item.branchName || '—' }}</td><td>{{ dateLabel(item.startAt || item.appointmentDate) }}</td>
       <td><span class="status">{{ statusLabel(item.status) }}</span></td>
       <td><span class="muted" title="Chi tiết chỉ hiển thị sau khi xác minh API">—</span></td></tr>
     } @empty {
       <tr><td colspan="8" class="message">Không có lịch hẹn phù hợp.</td></tr>
     }
    </tbody>
   </table></div>
   <footer><span>Đang hiển thị {{ rows().length }} trên tổng số {{ total() }} lịch hẹn</span>
    <div class="pagination"><button type="button" [disabled]="page()===1" (click)="goto(page()-1)">‹</button><span>Trang {{ page() }}</span><button type="button" [disabled]="page()*limit>=total()" (click)="goto(page()+1)">›</button></div>
   </footer>
  }
 </section>
</main></app-admin-catalog-shell>`,
 styles: [`
 :host{display:block;font-family:inherit;color:#25324a}.appointments{padding:32px;max-width:1250px;margin:auto}.breadcrumbs{display:flex;gap:10px;color:#718096;font-size:13px;margin-bottom:12px}.breadcrumbs strong{color:#27334a}.heading{display:flex;align-items:center;justify-content:space-between;margin-bottom:24px}.heading h1{font-size:26px;margin:0;font-weight:700}.panel{background:#fff;border:1px solid #e1e7ef;border-radius:12px;margin-bottom:18px;overflow:hidden}.filters{display:flex;gap:12px;padding:16px;align-items:center;flex-wrap:wrap}.filters .search{flex:1;min-width:220px}.filters input,.filters select{height:40px;border:1px solid #d8dfeb;border-radius:7px;background:#fff;padding:0 12px;width:100%;font:inherit;color:#334155}.filters label{min-width:160px}.primary,.secondary{display:inline-flex;align-items:center;justify-content:center;min-height:40px;border-radius:7px;padding:0 16px;font-size:14px;text-decoration:none;cursor:pointer}.primary{color:#fff;background:#0d47a1;border:1px solid #0d47a1}.secondary{color:#0d47a1;background:white;border:1px solid #cad7e7}.primary:hover{background:#123e82}.secondary:hover{background:#eef6fb}.scroll{overflow-x:auto}table{width:100%;border-collapse:collapse;min-width:920px;font-size:13px}th{background:#f7f9fc;text-align:left;font-weight:600;padding:16px 12px;white-space:nowrap;color:#334155}td{padding:17px 12px;border-top:1px solid #e7edf3}td:last-child,th:last-child{text-align:center}.status{padding:5px 10px;border-radius:12px;background:#eff4f9;color:#4b5b70;white-space:nowrap}.muted{color:#94a3b8}.message{padding:28px;text-align:center;color:#65758b}.message button{margin:8px}footer{padding:14px 20px;display:flex;justify-content:space-between;align-items:center;gap:10px;border-top:1px solid #edf1f6;font-size:13px;color:#677587}.pagination{display:flex;gap:12px;align-items:center}.pagination button{border:1px solid #d8e0eb;background:white;border-radius:5px;padding:7px 12px;cursor:pointer}.pagination button:disabled{opacity:.4;cursor:default}.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}@media(max-width:700px){.appointments{padding:18px}.heading h1{font-size:21px}.heading{gap:10px}.filters{align-items:stretch}.filters label{width:100%}footer{flex-wrap:wrap}}
 `]
})
export class AdminAppointmentsPageComponent {
 private readonly api=inject(ApiClientService);
 private readonly toast=inject(AdminToastService);
 private readonly destroyRef=inject(DestroyRef);
 readonly search=signal(''); readonly status=signal(''); readonly page=signal(1); readonly limit=10;
 readonly loading=signal(false); readonly error=signal(''); readonly rows=signal<AppointmentRow[]>([]); readonly total=signal(0);
 constructor(){this.load();}
 setSearch(value:string):void{this.search.set(value);}
 setStatus(value:string):void{this.status.set(value);this.page.set(1);this.load();}
 clear():void{this.search.set('');this.status.set('');this.page.set(1);this.load();}
 goto(n:number):void{if(n<1||n>Math.max(1,Math.ceil(this.total()/this.limit)))return;this.page.set(n);this.load();}
 load():void{
  let params=new HttpParams().set('page',String(this.page())).set('limit',String(this.limit));
  if(this.search().trim()) params=params.set('search',this.search().trim());
  if(this.status())params=params.set('status',this.status());
  this.loading.set(true);this.error.set('');
  this.api.get<AppointmentPage>('/appointments',{params}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
   next:data=>{this.rows.set(Array.isArray(data.items)?data.items:[]);this.total.set(data.totalItems??data.total??this.rows().length);this.loading.set(false);},
   error:e=>{this.rows.set([]);this.total.set(0);this.error.set(adminErrorMessage(e,'Chưa tải được lịch hẹn. Vui lòng thử lại.'));this.loading.set(false);}
  });
 }
 dateLabel(value?:string):string{if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?value:new Intl.DateTimeFormat('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);}
 statusLabel(s?:string):string{return ({PENDING:'Chờ xác nhận',CONFIRMED:'Đã xác nhận',COMPLETED:'Hoàn tất',CANCELLED:'Đã hủy'} as Record<string,string>)[s??'']||s||'—';}
}
