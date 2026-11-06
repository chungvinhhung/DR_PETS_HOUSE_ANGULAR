import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminBreadcrumbComponent } from '../../../../shared/admin-breadcrumb/admin-breadcrumb.component';
import { AdminDataStateComponent } from '../../../../shared/admin-data-state/admin-data-state.component';
import { AdminModerationService } from '../services/admin-moderation.service';

@Component({selector:'app-admin-feedback-detail',standalone:true,imports:[CommonModule,FormsModule,AdminCatalogShellComponent,AdminBreadcrumbComponent,AdminDataStateComponent],templateUrl:'./admin-feedback-detail.component.html',styleUrl:'./admin-feedback-detail.component.scss',changeDetection:ChangeDetectionStrategy.OnPush})
export class AdminFeedbackDetailComponent{
 private readonly route=inject(ActivatedRoute);private readonly api=inject(AdminModerationService);
 readonly data=signal<any|null>(null);readonly loading=signal(true);readonly error=signal('');readonly busy=signal(false);readonly actionPanel=signal(false);readonly processingNote=signal('');readonly success=signal('');readonly id=this.route.snapshot.paramMap.get('id')||'';
 ngOnInit():void{this.load();}
 load():void{this.loading.set(true);this.error.set('');this.api.getFeedback(this.id).pipe(finalize(()=>this.loading.set(false))).subscribe({next:v=>this.data.set(v),error:()=>this.error.set('Không thể tải chi tiết phản hồi.')});}
 actionLabel():string{const s=String(this.data()?.status||'NEW');if(s==='NEW'||s==='READ')return'Bắt đầu xử lý';if(s==='PROCESSING'||s==='NEED_CONTACT')return'Đánh dấu đã xử lý';return'Đã xử lý';}
 canAction():boolean{return ['NEW','READ','PROCESSING','NEED_CONTACT'].includes(String(this.data()?.status||''));}
 startProcess():void{if(this.busy()||!this.canAction())return;this.actionPanel.set(true);this.processingNote.set('');this.error.set('');}
 cancelProcess():void{if(!this.busy())this.actionPanel.set(false);}
 process():void{
  const d=this.data();if(!d||!this.canAction()||this.busy())return;
  const current=String(d.status||'NEW');
  const next=['NEW','READ'].includes(current)?'PROCESSING':'PROCESSED';
  this.busy.set(true);this.error.set('');this.success.set('');
  this.api.updateFeedback(this.id,next,this.processingNote().trim()).pipe(finalize(()=>this.busy.set(false))).subscribe({
   next:v=>{
    if(String(v?.status||'')!==next){this.error.set('BE chưa xác nhận trạng thái xử lý. Hãy tải lại dữ liệu.');return;}
    this.data.set({...d,...v});this.actionPanel.set(false);this.processingNote.set('');
    this.success.set(next==='PROCESSED'?'Đã đánh dấu phản hồi là đã xử lý.':'Đã chuyển phản hồi sang đang xử lý.');
   },
   error:err=>this.error.set(err?.error?.message||'Không thể cập nhật trạng thái phản hồi.')
  });
 }
 statusLabel(v:string):string{return ({NEW:'Mới',READ:'Đã đọc',PROCESSING:'Đang xử lý',PROCESSED:'Đã xử lý',NEED_CONTACT:'Cần liên hệ',REJECTED:'Từ chối'} as Record<string,string>)[v]??v;}
 date(v:any):string{if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('vi-VN');}
}
