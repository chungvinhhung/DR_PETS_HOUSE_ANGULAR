import { adminPageWindowWithEdges } from '../../../../shared/utils/admin-table-pagination';
import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiClientService } from '../../../../core/services/api-client.service';
import { AdminInventoryService } from '../../inventory/services/admin-inventory.service';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminDataStateComponent } from '../../../../shared/admin-data-state/admin-data-state.component';
import { adminErrorMessage } from '../../../../shared/services/admin-toast.service';
import {
  ServiceRecord, normalizeServiceRecordsPage, serviceRecordStatusLabel,
} from './admin-service-record.model';

@Component({
  selector:'app-admin-service-records',
  standalone:true,
  imports:[RouterLink,AdminCatalogShellComponent,AdminDataStateComponent],
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
    <select aria-label="Loại hồ sơ" [value]="category()" (change)="category.set($any($event.target).value);applyFilters(true)">
      <option value="">Loại hồ sơ</option><option value="MEDICAL">MEDICAL</option><option value="GROOMING">GROOMING</option>
    </select>
    <select aria-label="Chi nhánh" [value]="branch()" (change)="branch.set($any($event.target).value);applyFilters(true)">
      <option value="">Chi nhánh</option>
      @for (item of branches(); track item.id) {
        <option [value]="item.id">{{ item.name }}</option>
      }
    </select>
    <select aria-label="Trạng thái hồ sơ" [value]="status()" (change)="status.set($any($event.target).value);applyFilters(true)">
      <option value="">Trạng thái</option>
      <option value="COMPLETED">Hoàn thành</option>
      <option value="REOPENED">Đã mở lại</option>
      <option value="DRAFT">Bản nháp</option>
      <option value="WAITING_VET_REVIEW">Chờ BS duyệt</option>
      <option value="IN_PROGRESS">Đang thực hiện</option>
    </select>
  </section>
  <section class="panel">
   @if(loading()){<app-admin-data-state kind="loading" title="Đang tải hồ sơ dịch vụ" />}
   @else if(error()){<app-admin-data-state kind="error" title="Không thể tải hồ sơ dịch vụ" [message]="error()" (retry)="load()" />}
   @else {
    <div class="scroll"><table><thead><tr>
      <th>Mã hồ sơ</th><th>Ngày</th><th>Thú cưng</th><th>Dịch vụ</th><th>Chi nhánh</th>
      <th>Nhân viên chính</th><th>Loại hồ sơ</th><th>Trạng thái</th><th>Thao tác</th>
    </tr></thead>
    <tbody>
     @for(r of rows();track r.id) {
      <tr>
       <td class="code">#{{displayCode(r.code)}}</td><td>{{day(r.date)}}</td><td>{{r.petName||r.petId||'—'}}</td>
       <td>{{r.serviceName||r.serviceIds.join(', ')||'—'}}</td><td>{{r.branchName||branchName(r.branchId)||'—'}}</td>
       <td>{{r.primaryStaff||'—'}}</td><td>{{r.category==='UNKNOWN'?'—':r.category}}</td>
       <td><span class="badge" [attr.data-status]="color(r)">{{serviceRecordStatusLabel(r.status,r.rawStatus)}}</span></td>
       <td><a class="view" [routerLink]="['/admin/service-records',r.id]"
         [attr.aria-label]="'Xem hồ sơ '+r.code" title="Xem chi tiết hồ sơ">
         <img src="/assets/admin-branch/figma-eye.svg" width="20" height="20" alt="" aria-hidden="true">
       </a></td>
      </tr>
     } @empty {<tr><td colspan="9" class="message"><app-admin-data-state kind="empty" title="Không tìm thấy hồ sơ" message="Thử thay đổi từ khóa hoặc bộ lọc để xem kết quả khác." /></td></tr>}
    </tbody></table></div>
    <footer><span>Đang hiển thị {{rows().length}} trên tổng số {{total()}} hồ sơ dịch vụ
      @if(partial()){ <span> (trong tối đa 100 hồ sơ khớp bộ lọc)</span> }
    </span>
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
 </main>
</app-admin-catalog-shell>`,
  styles:[`
  :host{display:block;color:#273449}.record-list{box-sizing:border-box;width:100%;padding:32px}
  h1{height:48px;display:flex;align-items:center;font-size:20px;line-height:28px;font-weight:600;color:#101828;margin:0 0 8px}
  .panel{background:#fff;border:1px solid #dce5ef;border-radius:8px;margin-bottom:18px;overflow:hidden}
  .filter{min-height:54px;padding:10px 12px;display:flex;gap:10px;align-items:center;flex-wrap:nowrap}
  .filter select{box-sizing:border-box;appearance:none;-webkit-appearance:none;width:150px;height:36px;border:1px solid #d7e2ee;border-radius:8px;padding:0 36px 0 12px;font:400 12px/18px Roboto,Arial,sans-serif;color:#34445a;cursor:pointer;background:#fff url('/assets/admin-product/icon-chevron-down.svg') no-repeat right 10px center;background-size:18px 18px}
  .filter select:nth-of-type(2){width:160px}.filter select:nth-of-type(3){width:150px}
  .search{box-sizing:border-box;width:385px;max-width:385px;height:36px;border:1px solid #cfd8e6;border-radius:8px;display:flex;align-items:center;gap:9px;padding:0 12px;margin-right:auto}
  .search input{border:0;outline:0;min-width:0;width:100%;font:400 12px/18px Roboto,Arial,sans-serif;color:#34445a}
  table{width:100%;border-collapse:collapse;table-layout:fixed;min-width:1034px;font-size:12px}
  th{height:44px;box-sizing:border-box;background:#f8fafc;color:#2f3c4f;text-align:left;padding:0 12px;white-space:nowrap;font-weight:650}
  td{box-sizing:border-box;height:54px;padding:10px 12px;border-top:1px solid #e1e7ef;line-height:1.45;color:#44536c;vertical-align:middle}
  th:nth-child(1){width:11%}th:nth-child(2){width:10%}th:nth-child(3){width:10%}th:nth-child(4){width:14%}th:nth-child(5){width:12%}th:nth-child(6){width:14%}th:nth-child(7){width:10%}th:nth-child(8){width:12%}th:nth-child(9){width:7%}
  td:nth-child(8),th:nth-child(8),td:nth-child(9),th:nth-child(9){text-align:center}
  .code{font-weight:650;color:#263349}.scroll{overflow-x:auto}
  .badge{display:inline-flex;align-items:center;justify-content:center;padding:4px 10px;border-radius:99px;background:#e3f3ff;color:#2561af;white-space:nowrap;font-size:11px}
  .badge[data-status=success]{background:#e5f6e9;color:#287b40}.badge[data-status=warning]{background:#fff3df;color:#ae7210}
  .view{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:6px}.view img{display:block;width:20px;height:20px}.view:hover{background:#ecf4ff}
  footer{min-height:58px;display:flex;justify-content:space-between;align-items:center;padding:8px 18px;border-top:1px solid #e2e8f0;color:#6c7a90;font-size:11px}
  .pages{display:flex;gap:0;align-items:stretch;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden}
  .pages :is(button,span){box-sizing:border-box;display:grid;place-items:center;flex:0 0 48px;width:48px;min-width:48px;height:44px;padding:0;border:0;border-right:1px solid #e2e8f0;border-radius:0;background:#fff;color:#475569;font:400 14px/20px Roboto,Arial,sans-serif
  .pages :is(button,span):last-child{border-right:0}.pages button:first-child,.pages button:last-child{flex-basis:44px;width:44px;min-width:44px}.pages button{cursor:pointer}.pages button:disabled{color:#bac8d9;cursor:not-allowed}.pages button.page-active{background:#e5f6fd;color:#0d47a1;box-shadow:inset 0 0 0 1px #0d47a1;font-weight:700}
  .message{padding:26px;text-align:center;color:#64748b}.message button{padding:8px 14px;border:1px solid #cad9eb;border-radius:6px;background:white;color:#0d47a1;cursor:pointer}
  .sr{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0,0,0,0)}
  @media(max-width:900px){.filter{flex-wrap:wrap}.search{width:100%;max-width:none}.filter select{flex:1}.record-list{padding:20px}}
  @media(max-width:620px){.record-list{padding:16px}footer{flex-wrap:wrap;gap:10px}}
  `],
  changeDetection:ChangeDetectionStrategy.OnPush,
})
export class AdminServiceRecordsComponent {
  private readonly api=inject(ApiClientService);
  private readonly inventoryApi=inject(AdminInventoryService);
  private readonly destroyRef=inject(DestroyRef);
  private request=0;
  private readonly fetched=signal<ServiceRecord[]>([]);
  readonly partial=computed(()=>this.fetched().length>=100);
  readonly filtered=computed(()=>{
    const q=this.search().trim().toLocaleLowerCase('vi');
    return this.fetched().filter(r=>
      !q || [r.id,r.code,r.appointmentId,r.petName,r.serviceName,r.branchName,r.primaryStaff]
        .some(value=>value.toLocaleLowerCase('vi').includes(q)));
  });
  readonly rows=computed(()=>this.filtered().slice((this.page()-1)*this.size,this.page()*this.size));
  readonly loading=signal(false);
  readonly error=signal('');
  readonly total=computed(()=>this.filtered().length);
  readonly pageCount=computed(()=>Math.max(1,Math.ceil(this.total()/this.size)));
  readonly pageNumbers=computed(()=>adminPageWindowWithEdges(this.page(),this.pageCount()));
  readonly page=signal(1);
  readonly size=7;
  readonly search=signal('');
  readonly category=signal('');
  readonly status=signal('');
  readonly branch=signal('');
  readonly branches=signal<{id:string;name:string}[]>([]);
  readonly serviceRecordStatusLabel=serviceRecordStatusLabel;
  constructor(){
    this.inventoryApi.listBranches().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:rows=>this.branches.set(rows.map(row=>({id:row.id,name:row.name}))),
      error:()=>this.branches.set([]),
    });
    this.load();
  }
  applyFilters(reload=false){
    this.page.set(1);
    if(reload)this.load();
  }
  go(value:number){if(value<1||value>this.pageCount())return;this.page.set(value);}
  load(){
    // BE filters recordType/status/branchId server-side, but still caps the result at 100.
    let params=new HttpParams().set('limit',100);
    if(this.category())params=params.set('recordType',this.category());
    if(this.status())params=params.set('status',this.status()==='COMPLETED'?'FINALIZED':this.status());
    if(this.branch())params=params.set('branchId',this.branch());
    const req=++this.request;
    this.loading.set(true);this.error.set('');
    // Confirmed source route in BE foundation-v6: GET /api/v1/service-records.
    this.api.get<unknown>('/service-records',{params}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:raw=>{if(req!==this.request)return;try{
          const result=normalizeServiceRecordsPage(raw);
          this.fetched.set(result.items);this.loading.set(false);
        }catch(err){this.fetched.set([]);this.error.set(err instanceof Error?err.message:'Dữ liệu không hợp lệ.');this.loading.set(false);}
      },
      error:err=>{if(req!==this.request)return;this.fetched.set([]);this.error.set(adminErrorMessage(err,'Không thể tải hồ sơ dịch vụ. Vui lòng thử lại.'));this.loading.set(false);}
    });
  }
  displayCode(value:string){return value.replace(/^#/,'');}
  color(r:ServiceRecord){return r.status==='COMPLETED'?'success':r.status==='WAITING_VET_REVIEW'?'warning':'info';}
  branchName(id:string){return this.branches().find(item=>item.id===id)?.name||id;}
  day(value:string|null){if(!value)return '—';const d=new Date(value);return Number.isNaN(d.getTime())?'—':
    new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric'}).format(d);}
}
