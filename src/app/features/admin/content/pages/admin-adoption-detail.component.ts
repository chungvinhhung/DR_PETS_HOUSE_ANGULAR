import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminBreadcrumbComponent } from '../../../../shared/admin-breadcrumb/admin-breadcrumb.component';
import { AdminDataStateComponent } from '../../../../shared/admin-data-state/admin-data-state.component';
import { AdminContentService } from '../services/admin-content.service';

@Component({
 selector:'app-admin-adoption-detail',
 standalone:true,
 imports:[FormsModule,AdminCatalogShellComponent,AdminBreadcrumbComponent,AdminDataStateComponent],
 templateUrl:'./admin-adoption-detail.component.html',
 styleUrl:'./admin-adoption-detail.component.scss',
 changeDetection:ChangeDetectionStrategy.OnPush,
})
export class AdminAdoptionDetailComponent{
 private readonly route=inject(ActivatedRoute);
 private readonly api=inject(AdminContentService);
 readonly data=signal<any|null>(null);
 readonly loading=signal(true);
 readonly error=signal('');
 readonly actionError=signal('');
 readonly notice=signal('');
 readonly reviewChoice=signal<'APPROVED'|'REJECTED'|null>(null);
 readonly reviewNote=signal('');
 readonly busy=signal(false);
 readonly id=this.route.snapshot.paramMap.get('id')||'';

 ngOnInit():void{this.load();}

 load():void{
  this.loading.set(true);this.error.set('');
  this.api.listAdoptionRequests().pipe(finalize(()=>this.loading.set(false))).subscribe({
   next:rows=>{
    this.data.set(rows.find(r=>String(r.id||r._id)===this.id)||null);
    if(!this.data())this.error.set('Không tìm thấy đơn đăng ký nhận nuôi.');
   },
   error:()=>this.error.set('Đã có lỗi xảy ra khi tải đơn đăng ký. Vui lòng thử lại.'),
  });
 }

 startReview(status:'APPROVED'|'REJECTED'):void {
  if(!this.isPending(this.data())||this.busy())return;
  this.reviewChoice.set(status);this.reviewNote.set('');
  this.actionError.set('');this.notice.set('');
 }
 cancelReview():void {
  if(this.busy())return;
  this.reviewChoice.set(null);this.reviewNote.set('');this.actionError.set('');
 }
 review():void {
  const d=this.data();const id=String(d?._id||d?.id||this.id);
  const status=this.reviewChoice();
  if(!id||!status||this.busy()||!this.isPending(d))return;
  if(status==='REJECTED' && this.reviewNote().trim().length<3){
    this.actionError.set('Vui lòng nhập lý do từ chối tối thiểu 3 ký tự.');return;
  }
  this.busy.set(true);this.actionError.set('');
  this.api.reviewAdoptionRequest(id,status,this.reviewNote()).pipe(finalize(()=>this.busy.set(false))).subscribe({
   next:updated=>{
    const actual=String(updated?.status||'').toUpperCase();
    if(actual!==status){
      this.actionError.set('BE chưa xác nhận đúng trạng thái xét duyệt. Vui lòng tải lại dữ liệu.');return;
    }
    this.data.set({...d,...updated});
    this.reviewChoice.set(null);this.reviewNote.set('');
    this.notice.set(status==='APPROVED'?'Đã duyệt đơn nhận nuôi.':'Đã từ chối đơn nhận nuôi.');
   },
   error:(err:any)=>this.actionError.set(err?.error?.message||
     (status==='APPROVED'?'Không thể duyệt đơn. Vui lòng thử lại.':'Không thể từ chối đơn. Vui lòng thử lại.')),
  });
 }

 value(...v:any[]):string{return v.find(x=>x!==undefined&&x!==null&&String(x).trim()!=='')??'—';}
 applicant(d:any):any{return d?.applicantInfo||{};}
 pet(d:any):any{return d?.rescuePetId||{};}
 statusLabel(value:any):string{return ({PENDING:'Chờ duyệt',APPROVED:'Đã duyệt',REJECTED:'Đã từ chối',CANCELLED:'Đã hủy'} as Record<string,string>)[String(value||'').toUpperCase()]||String(value||'—');}
 date(value:any):string{
  if(!value)return '—';const parsed=new Date(value);
  return Number.isNaN(parsed.getTime())?'—':parsed.toLocaleDateString('vi-VN');
 }
 isPending(d:any):boolean{return String(d?.status||'').toUpperCase()==='PENDING';}
}