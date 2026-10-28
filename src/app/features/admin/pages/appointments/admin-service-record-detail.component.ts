import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ApiClientService } from '../../../../core/services/api-client.service';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { adminErrorMessage } from '../../../../shared/services/admin-toast.service';
import {
 ServiceRecord, canFinalizeServiceRecord, normalizeServiceRecordDetail, serviceRecordStatusLabel,
} from './admin-service-record.model';

@Component({
 selector:'app-admin-service-record-detail',
 standalone:true,
 imports:[AdminCatalogShellComponent,RouterLink],
 template:`
<app-admin-catalog-shell activeItem="service-records"><main class="record-detail">
 <header class="heading">
  <div>
   <nav class="crumb" aria-label="Đường dẫn"><span>Dịch vụ</span><span>›</span>
     <a routerLink="/admin/service-records">Hồ sơ dịch vụ</a><span>›</span><strong>Chi tiết hồ sơ</strong></nav>
   <h1>Chi tiết hồ sơ dịch vụ {{item()?.code||''}}</h1>
  </div>
  <a class="btn btn--outline" routerLink="/admin/service-records">Quay lại danh sách</a>
 </header>
 @if(loading()){<section class="panel message" role="status">Đang tải hồ sơ dịch vụ...</section>}
 @else if(error()){<section class="panel message" role="alert"><p>{{error()}}</p>
  <button type="button" class="btn btn--outline" (click)="load()">Thử lại</button></section>}
 @else if(item();as r){
  <section class="summary">
   <h2>Thông tin hồ sơ</h2>
   <div class="facts">
    <div><label>Thú cưng</label><strong>{{r.petName||'—'}}{{r.petDescription?' · '+r.petDescription:''}}</strong></div>
    <div><label>Dịch vụ</label><strong>{{r.serviceName||'—'}}</strong></div>
    <div><label>Loại hồ sơ</label><strong>{{r.category==='UNKNOWN'?'Chưa rõ':r.category}}</strong></div>
    <div><label>Trạng thái</label><strong>{{serviceRecordStatusLabel(r.status,r.rawStatus)}}</strong></div>
   </div>
  </section>
  <section class="panel">
   <h2>Thông tin thực hiện</h2>
   <div class="facts facts--five">
    <div><label>Chi nhánh</label><strong>{{r.branchName||'—'}}</strong></div>
    <div><label>Nhân viên chính</label><strong>{{r.primaryStaff||'—'}}{{r.primaryRole?' · '+r.primaryRole:''}}</strong></div>
    <div><label>Lịch hẹn</label>
      @if(r.appointmentId){<a [routerLink]="['/admin/appointments',r.appointmentId]">{{r.appointmentCode||r.appointmentId}}</a>}
      @else{<strong>Chưa có dữ liệu</strong>}
    </div>
    <div><label>Thời gian hẹn</label><strong>{{displayTime(r.date)}}</strong></div>
    <div><label>Hoàn thành lúc</label><strong>{{displayTime(r.completedAt)}}</strong></div>
   </div>
  </section>
  <section class="panel">
   <h2>Kết quả / Ghi chú</h2>
   <p class="notes">{{r.note||'Chưa có kết quả hoặc ghi chú.'}}</p>
   @if(r.category==='GROOMING' && r.status==='COMPLETED'){
    <p class="finalization">Hồ sơ đã hoàn tất.</p>
   }
  </section>
  @if(r.category==='MEDICAL'){
   <section class="panel">
    <h2>Kiểm tra MEDICAL — Nurse / Veterinarian review</h2>
    <div class="facts">
     <div><label>Có Nurse segment</label><strong>{{r.nurseSegment===null?'Chưa xác định':r.nurseSegment?'Có':'Không'}}</strong></div>
     <div><label>Trạng thái BS thú y review</label>
      <strong>{{r.veterinarianReview==='DONE'?'Đã review':r.veterinarianReview==='PENDING'?'Chờ review':'Chưa xác minh'}}</strong></div>
     <div><label>BS review</label><strong>{{r.reviewedBy||'Chưa có dữ liệu'}}</strong></div>
     <div><label>Thời gian review</label><strong>{{displayTime(r.reviewedAt)}}</strong></div>
    </div>
    <p class="hint" role="status">{{finalization().reason}}</p>
   </section>
  }
  @if(r.category==='MEDICAL'){
    <section class="panel">
      <h2>Nội dung chuyên môn của Bác sĩ thú y</h2>
      <div class="facts">
        <div><label>Chẩn đoán</label><strong>{{r.professional?.diagnosis || 'Chưa có dữ liệu'}}</strong></div>
        <div><label>Điều trị</label><strong>{{r.professional?.treatment || 'Chưa có dữ liệu'}}</strong></div>
        <div><label>Kết quả</label><strong>{{r.professional?.result || 'Chưa có dữ liệu'}}</strong></div>
        <div><label>Ghi chú chuyên môn</label><strong>{{r.professional?.professionalNote || 'Chưa có dữ liệu'}}</strong></div>
      </div>
      <p class="hint">Chỉ bác sĩ thú y được phân quyền mới có thể cập nhật nội dung chuyên môn.</p>
    </section>
  }
  <section class="panel">
   <h2>Vật liệu thực tế đã dùng</h2>
   @if(r.materials.length){
     <div class="scroll"><table><thead><tr><th>Vật tư</th><th>Template</th><th>Thực tế</th><th>Ghi chú</th></tr></thead>
      <tbody>@for(m of r.materials;track $index){
       <tr><td>{{m.name||'—'}}</td><td>{{m.templateQuantity?m.templateQuantity+' '+m.unit:'—'}}</td>
        <td>{{m.actualQuantity?m.actualQuantity+' '+m.unit:'—'}}</td><td>{{m.note||'—'}}</td></tr>
      }</tbody></table></div>
   }@else{<p class="hint">Chưa có thông tin vật tư đã sử dụng.</p>}
   <p class="hint">Số vật liệu thực tế phải được xác nhận qua ServiceRecord và nghiệp vụ kho; FE không tự trừ tồn kho.</p>
  </section>
  <section class="panel">
    <h2>Nhật ký / Audit</h2>
    @if(r.history.length){
      <ol class="history">@for(event of r.history;track $index){
        <li><strong>{{event.action}}</strong><span>{{displayTime(event.at)}}</span>
          @if(event.actor){<small>Người thực hiện: {{event.actor}}</small>}
          @if(event.note){<p>{{event.note}}</p>}
        </li>
      }</ol>
    }@else{<p class="hint">Chưa có lịch sử thao tác.</p>}
  </section>
  <div class="actions">
    @if(r.status==='COMPLETED'){
      <button type="button" class="btn btn--outline" (click)="explainReopen()">Mở lại hồ sơ</button>
    }@else{
      <button type="button" class="btn btn--primary" (click)="explainFinalize()">Kiểm tra điều kiện hoàn tất</button>
    }
  </div>
  @if(actionMessage()){<p class="notification" role="status">{{actionMessage()}}</p>}
 }
</main></app-admin-catalog-shell>`,
 styles:[`
 :host{display:block;color:#29364c}.record-detail{max-width:1160px;padding:28px 32px;margin:auto}
 .heading{display:flex;justify-content:space-between;gap:14px;align-items:center;margin-bottom:24px}
 .crumb{display:flex;gap:9px;align-items:center;font-size:12px;color:#8491a5;margin-bottom:8px}
 .crumb a{color:#64748b;text-decoration:none}.crumb strong{color:#283448}
 h1{font-size:22px;margin:0}h2{font-size:16px;margin:0 0 14px}
 .summary{padding:0 14px;margin-bottom:26px}.panel{padding:16px;border:1px solid #dee7f1;border-radius:11px;margin-bottom:18px;background:white}
 .facts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:22px}.facts--five{grid-template-columns:repeat(5,minmax(0,1fr))}
 .facts>div{display:flex;flex-direction:column;gap:8px;min-width:0}.facts label{font-size:12px;color:#728097}.facts strong,.facts a{font-size:12px;font-weight:600;color:#273449;overflow-wrap:anywhere}.facts a{color:#0d47a1}
 .notes{white-space:pre-wrap;font-size:13px;line-height:1.7;color:#455269;margin:8px 0}
 .finalization{font-size:12px;color:#25834e;margin-top:12px}
 .hint{color:#74849a;font-size:12px;line-height:1.6;margin:12px 0 0}
 .btn{display:inline-flex;align-items:center;justify-content:center;border-radius:7px;min-height:40px;padding:9px 15px;white-space:nowrap;text-decoration:none;cursor:pointer;font-size:12px;font-weight:600}
 .btn--outline{background:#fff;color:#0d47a1;border:1px solid #0d47a1}
 .btn--primary{background:#0d47a1;color:white;border:1px solid #0d47a1}
 .scroll{overflow-x:auto}table{width:100%;border-collapse:collapse;font-size:12px;min-width:600px}th{background:#f5f8fb;text-align:left;color:#344154;padding:12px}td{padding:12px;border-top:1px solid #e0e7f0;color:#46556d}
 .history{list-style:none;border-left:2px solid #d9e6f7;margin:4px 0 0 8px;padding-left:22px}
 .history li{position:relative;padding:0 0 16px;margin-bottom:8px;display:flex;gap:8px;flex-wrap:wrap;font-size:12px}
 .history li:before{content:'';position:absolute;width:8px;height:8px;background:#0d47a1;left:-27px;top:4px;border-radius:50%}
 .history span,.history small{color:#8793a6}.history small{width:100%}.history p{margin:0;width:100%;color:#53657d}
 .actions{display:flex;justify-content:flex-end}.notification{border:1px solid #f1d69b;border-radius:7px;background:#fff8ec;padding:12px;color:#81540d;font-size:12px}
 .message{text-align:center;padding:35px;color:#718096}
 @media(max-width:850px){.facts,.facts--five{grid-template-columns:repeat(2,1fr)}.record-detail{padding:16px}}
 @media(max-width:520px){.facts,.facts--five{grid-template-columns:1fr}.heading{flex-wrap:wrap}}
 `],
 changeDetection:ChangeDetectionStrategy.OnPush,
})
export class AdminServiceRecordDetailComponent{
 private readonly api=inject(ApiClientService);
 private readonly route=inject(ActivatedRoute);
 private readonly destroyRef=inject(DestroyRef);
 private version=0;
 readonly id=signal(this.route.snapshot.paramMap.get('id')||'');
 readonly loading=signal(false);
 readonly error=signal('');
 readonly item=signal<ServiceRecord|null>(null);
 readonly actionMessage=signal('');
 readonly serviceRecordStatusLabel=serviceRecordStatusLabel;
 readonly finalization=computed(()=>this.item()?canFinalizeServiceRecord(this.item()!):{allowed:false,reason:'Chưa có hồ sơ.'});
 constructor(){
   this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(p=>{
     const id=p.get('id')||'';if(id && id!==this.id()){this.id.set(id);this.load();}
   });
   this.load();
 }
 load(){
   if(!this.id()){this.error.set('Không có mã định danh hồ sơ.');return;}
   const v=++this.version;this.loading.set(true);this.error.set('');this.item.set(null);this.actionMessage.set('');
   // Proposed read-only endpoint; do not expose data without BE scope authorization.
   this.api.get<unknown>('/service-records/'+encodeURIComponent(this.id()))
    .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:raw=>{if(v!==this.version)return;try{
        const r=normalizeServiceRecordDetail(raw);
        if(r.id!==this.id())throw new Error('API trả hồ sơ không khớp ID.');
        this.item.set(r);this.loading.set(false);
      }catch(err){this.error.set(err instanceof Error?err.message:'Không đọc được hồ sơ.');this.loading.set(false);}},
      error:err=>{if(v!==this.version)return;this.error.set(adminErrorMessage(err,'Không tải được chi tiết hồ sơ.'));this.loading.set(false);}
    });
 }
 displayTime(value:string|null){if(!value)return 'Chưa có dữ liệu';const d=new Date(value);return Number.isNaN(d.getTime())?value:
   new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'}).format(d);}
 explainFinalize(){
   const check=this.finalization();
   this.actionMessage.set(check.allowed ?
    'Hồ sơ đã đáp ứng các điều kiện hiển thị. Chức năng hoàn tất hồ sơ hiện chưa khả dụng.' :
    check.reason);
 }
 explainReopen(){this.actionMessage.set('Chức năng mở lại hồ sơ hiện chưa khả dụng. Hồ sơ chưa có thay đổi.');}
}
