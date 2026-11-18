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
 readonly data=signal<any|null>(null);readonly loading=signal(true);readonly error=signal('');readonly busy=signal(false);readonly actionPanel=signal(false);readonly processingNote=signal('');readonly success=signal('');readonly nextStatus=signal('');readonly id=this.route.snapshot.paramMap.get('id')||'';
 ngOnInit():void{this.load();}
 load():void{this.loading.set(true);this.error.set('');this.api.getFeedback(this.id).pipe(finalize(()=>this.loading.set(false))).subscribe({next:v=>this.data.set(v),error:()=>this.error.set('Không thể tải chi tiết phản hồi.')});}
 actionLabel():string{return 'Cập nhật trạng thái';}
 private readonly allowed:Record<string,string[]>={
  NEW:['READ','PROCESSING','REJECTED'],
  READ:['PROCESSING','REJECTED'],
  PROCESSING:['NEED_CONTACT','PROCESSED','REJECTED'],
  NEED_CONTACT:['PROCESSING','PROCESSED','REJECTED'],
  PROCESSED:[],REJECTED:[],
 };
 nextOptions():string[]{
  const current=String(this.data()?.status||'NEW').toUpperCase();
  return this.allowed[current]||[];
 }
 canAction():boolean{return this.nextOptions().length>0;}
 feedbackGender(v:any):string{
  return ({female:'Nữ',male:'Nam',other:'Khác'} as Record<string,string>)[String(v||'').toLowerCase()]||'—';
 }
 startProcess():void{
  if(this.busy()||!this.canAction())return;
  this.nextStatus.set(this.nextOptions()[0]);this.actionPanel.set(true);
  this.processingNote.set('');this.error.set('');this.success.set('');
 }
 cancelProcess():void{if(!this.busy())this.actionPanel.set(false);}
 process():void{
  const d=this.data();const next=this.nextStatus();
  if(!d||!this.canAction()||this.busy())return;
  if(!this.nextOptions().includes(next)){
    this.error.set('Trạng thái không hợp lệ cho bước xử lý hiện tại.');return;
  }
  if(next==='REJECTED'&&this.processingNote().trim().length<3){
    this.error.set('Vui lòng nhập lý do từ chối ít nhất 3 ký tự.');return;
  }
  this.busy.set(true);this.error.set('');this.success.set('');
  this.api.updateFeedback(this.id,next,this.processingNote().trim())
    .pipe(finalize(()=>this.busy.set(false))).subscribe({
   next:v=>{
    if(String(v?.status||'').toUpperCase()!==next){
      this.error.set('Chưa xác nhận được trạng thái xử lý. Vui lòng tải lại để kiểm tra.');return;
    }
    this.data.set({...d,...v});this.actionPanel.set(false);
    this.processingNote.set('');this.nextStatus.set('');
    this.success.set('Đã cập nhật trạng thái: '+this.statusLabel(next)+'.');
   },
   error:err=>this.error.set(err?.error?.message||'Không thể cập nhật trạng thái phản hồi.')
  });
 }
 statusLabel(v:string):string{return ({NEW:'Mới',READ:'Đã đọc',PROCESSING:'Đang xử lý',PROCESSED:'Đã xử lý',NEED_CONTACT:'Cần liên hệ',REJECTED:'Từ chối'} as Record<string,string>)[v]??v;}
 date(v:any):string{if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('vi-VN');}
}
