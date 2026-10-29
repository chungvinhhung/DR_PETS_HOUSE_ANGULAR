import { adminPageWindow } from '../../../../shared/utils/admin-table-pagination';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiClientService } from '../../../../core/services/api-client.service';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { adminErrorMessage } from '../../../../shared/services/admin-toast.service';
import {
  ServiceRecord, normalizeServiceRecordsPage, serviceRecordStatusLabel,
} from './admin-service-record.model';

@Component({
  selector:'app-admin-service-records',
  standalone:true,
  imports:[RouterLink,AdminCatalogShellComponent],
  template:`
<app-admin-catalog-shell activeItem="service-records">
 <main class="record-list">
  <h1>Hồ sơ dịch vụ</h1>
  <section class="panel filter" aria-label="Bộ lọc hồ sơ dịch vụ">
    <label class="search"><img src="/assets/service-catalog/search.svg" width="16" height="16" alt=""/>
      <span class="sr">Tìm hồ sơ dịch vụ</span>
      <input type="search" placeholder="Tìm mã hồ sơ, thú cưng..." [value]="search()"
        (input)="search.set($any($event.target).value)" (keydown.enter)="applyFilters()"/>
    </label>
    <select aria-label="Loại hồ sơ" [value]="category()" (change)="category.set($any($event.target).value);applyFilters()">
      <option value="">Loại hồ sơ</option><option value="MEDICAL">MEDICAL</option><option value="GROOMING">GROOMING</option>
    </select>
    <select aria-label="Chi nhánh" disabled title="Chưa có contract lọc chi nhánh của hồ sơ dịch vụ">
      <option>Chi nhánh</option>
    </select>
    <select aria-label="Trạng thái hồ sơ" [value]="status()" (change)="status.set($any($event.target).value);applyFilters()">
      <option value="">Trạng thái</option>
      <option value="COMPLETED">Hoàn thành</option>
      <option value="REOPENED">Đã mở lại</option>
      <option value="DRAFT">Bản nháp</option>
      <option value="AWAITING_VET_REVIEW">Chờ BS duyệt</option>
      <option value="IN_PROGRESS">Đang thực hiện</option>
    </select>
  </section>
  <section class="panel">
   @if(loading()){<p class="message" role="status">Đang tải hồ sơ dịch vụ...</p>}
   @else if(error()){<div class="message" role="alert"><p>{{error()}}</p><button type="button" (click)="load()">Thử lại</button></div>}
   @else {
    <div class="scroll"><table><thead><tr>
      <th>Mã hồ sơ</th><th>Ngày</th><th>Thú cưng</th><th>Dịch vụ</th><th>Chi nhánh</th>
      <th>Nhân viên chính</th><th>Loại hồ sơ</th><th>Trạng thái</th><th>Thao tác</th>
    </tr></thead>
    <tbody>
     @for(r of rows();track r.id) {
      <tr>
       <td class="code">{{r.code}}</td><td>{{day(r.date)}}</td><td>{{r.petName||'—'}}</td>
       <td>{{r.serviceName||'—'}}</td><td>{{r.branchName||'—'}}</td>
       <td>{{r.primaryStaff||'—'}}</td><td>{{r.category==='UNKNOWN'?'—':r.category}}</td>
       <td><span class="badge" [attr.data-status]="color(r)">{{serviceRecordStatusLabel(r.status,r.rawStatus)}}</span></td>
       <td><a class="view" [routerLink]="['/admin/service-records',r.id]"
         [attr.aria-label]="'Xem hồ sơ '+r.code" title="Xem chi tiết hồ sơ">
         <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true">
          <path d="M2 12c2.8-4 6-6 10-6s7.2 2 10 6c-2.8 4-6 6-10 6S4.8 16 2 12Z"/>
          <circle cx="12" cy="12" r="3"/>
         </svg>
       </a></td>
      </tr>
     } @empty {<tr><td colspan="9" class="message">Không có hồ sơ phù hợp.</td></tr>}
    </tbody></table></div>
    <footer><span>Đang hiển thị {{rows().length}} / {{total()}} hồ sơ đã tải @if(partial()){ (giới hạn 100 bản ghi) }</span>
     <nav class="pages" aria-label="Phân trang hồ sơ dịch vụ">
       <button type="button" (click)="go(page()-1)" [disabled]="page()===1" aria-label="Trang trước">‹</button>
       @for (index of pageNumbers(); track $index) {
         @if(index==='…'){<span aria-hidden="true">…</span>}
         @else {<button type="button" [class.page-active]="index===page()" [attr.aria-current]="index===page()?'page':null" (click)="go(index)">{{index}}</button>}
       }
       <button type="button" (click)="go(page()+1)" [disabled]="page()>=pageCount()" aria-label="Trang sau">›</button>
     </nav>
    </footer>
   }
  </section>
  <p class="note">Danh sách chỉ lấy dữ liệu từ Backend, không có hồ sơ mẫu. Bộ lọc chi nhánh sẽ được bật sau khi BE xác nhận API và phân quyền.</p>
 </main>
</app-admin-catalog-shell>`,
  styles:[`
  :host{display:block;color:#273449}.record-list{padding:32px;max-width:1190px;margin:auto}h1{font-size:24px;margin:4px 0 26px}
  .panel{background:#fff;border:1px solid #dce5ef;border-radius:11px;margin-bottom:18px;overflow:hidden}
  .filter{padding:16px;display:flex;gap:10px;align-items:center;flex-wrap:wrap}.filter select{height:40px;border:1px solid #d7e2ee;border-radius:8px;padding:0 12px;font:inherit;font-size:13px;color:#34445a;background:white;min-width:130px}.filter select:disabled{opacity:.6}
  .search{height:40px;border:1px solid #cfd8e6;border-radius:8px;display:flex;align-items:center;gap:9px;padding:0 12px;flex:1;min-width:235px}
  .search input{border:0;outline:0;min-width:0;width:100%;font:inherit;font-size:13px}table{width:100%;border-collapse:collapse;min-width:1050px;font-size:12px}th{background:#f8fafc;color:#2f3c4f;text-align:left;padding:14px 11px;white-space:nowrap}
  td{padding:15px 11px;border-top:1px solid #e1e7ef;line-height:1.5;color:#44536c}td:nth-last-child(-n+2),th:nth-last-child(-n+2){text-align:center}
  .code{font-weight:650;color:#263349}.scroll{overflow-x:auto}.badge{display:inline-flex;align-items:center;padding:4px 9px;border-radius:99px;background:#ebf3ff;color:#2561af;white-space:nowrap;font-size:11px}
  .badge[data-status=success]{background:#e5f6e9;color:#287b40}.badge[data-status=warning]{background:#fff3df;color:#ae7210}
  .view{display:inline-flex;align-items:center;justify-content:center;color:#111;padding:4px;border-radius:6px}.view:hover{background:#ecf4ff;color:#0d47a1}
  footer{display:flex;justify-content:space-between;align-items:center;padding:15px 18px;border-top:1px solid #e2e8f0;color:#6c7a90;font-size:12px}.pages{display:flex;gap:12px;align-items:center}.pages button{background:#fff;border:1px solid #d4dfeb;border-radius:5px;padding:6px 13px;cursor:pointer}.pages button:disabled{opacity:.35;cursor:not-allowed}.pages button.page-active{background:#e6f2ff;border-color:#0d47a1;color:#0d47a1;font-weight:700}.pages>span{padding:0 3px}
  .message{padding:26px;text-align:center;color:#64748b}.message button{padding:8px 14px;border:1px solid #cad9eb;border-radius:6px;background:white;color:#0d47a1;cursor:pointer}
  .note{font-size:12px;color:#7b899c;line-height:1.6}.sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
  @media(max-width:720px){.record-list{padding:16px}footer{flex-wrap:wrap}.filter select{flex:1}}
  `],
  changeDetection:ChangeDetectionStrategy.OnPush,
})
export class AdminServiceRecordsComponent {
  private readonly api=inject(ApiClientService);
  private readonly destroyRef=inject(DestroyRef);
  private request=0;
  private readonly fetched=signal<ServiceRecord[]>([]);
  readonly partial=computed(()=>this.fetched().length>=100);
  readonly filtered=computed(()=>{
    const q=this.search().trim().toLocaleLowerCase('vi');
    return this.fetched().filter(r=>
      (!this.category() || r.category===this.category()) &&
      (!this.status() || r.status===this.status()) &&
      (!q || [r.id,r.code,r.appointmentId,r.petName,r.serviceName,r.branchName,r.primaryStaff]
        .some(value=>value.toLocaleLowerCase('vi').includes(q))));
  });
  readonly rows=computed(()=>this.filtered().slice((this.page()-1)*this.size,this.page()*this.size));
  readonly loading=signal(false);
  readonly error=signal('');
  readonly total=computed(()=>this.filtered().length);
  readonly pageCount=computed(()=>Math.max(1,Math.ceil(this.total()/this.size)));
  readonly pageNumbers=computed(()=>adminPageWindow(this.page(),this.pageCount()));
  readonly page=signal(1);
  readonly size=7;
  readonly search=signal('');
  readonly category=signal('');
  readonly status=signal('');
  readonly serviceRecordStatusLabel=serviceRecordStatusLabel;
  constructor(){this.load();}
  applyFilters(){this.page.set(1);}
  go(value:number){if(value<1||value>this.pageCount())return;this.page.set(value);}
  load(){
    // BE list accepts recordType/status, but does not implement page/search.
    // Download the first bounded batch and label the UI as a subset.
    const params=new HttpParams().set('limit',100);
    const req=++this.request;
    this.loading.set(true);this.error.set('');
    // Confirmed source route in BE foundation-v6: GET /api/v1/service-records.
    this.api.get<unknown>('/service-records',{params}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:raw=>{if(req!==this.request)return;try{
          const result=normalizeServiceRecordsPage(raw);
          this.fetched.set(result.items);this.loading.set(false);
        }catch(err){this.fetched.set([]);this.error.set(err instanceof Error?err.message:'Dữ liệu không hợp lệ.');this.loading.set(false);}
      },
      error:err=>{if(req!==this.request)return;this.fetched.set([]);this.error.set(adminErrorMessage(err,'Chưa tải được hồ sơ dịch vụ từ BE.'));this.loading.set(false);}
    });
  }
  color(r:ServiceRecord){return r.status==='COMPLETED'?'success':r.status==='AWAITING_VET_REVIEW'?'warning':'info';}
  day(value:string|null){if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?'—':
    new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric'}).format(d);}
}
