import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminBreadcrumbComponent } from '../../../../shared/admin-breadcrumb/admin-breadcrumb.component';
import { AdminDataStateComponent } from '../../../../shared/admin-data-state/admin-data-state.component';
import { AdminModerationService } from '../services/admin-moderation.service';

@Component({selector:'app-admin-feedback-detail',standalone:true,imports:[CommonModule,RouterLink,AdminCatalogShellComponent,AdminBreadcrumbComponent,AdminDataStateComponent],templateUrl:'./admin-feedback-detail.component.html',styleUrl:'./admin-feedback-detail.component.scss',changeDetection:ChangeDetectionStrategy.OnPush})
export class AdminFeedbackDetailComponent{
 private readonly route=inject(ActivatedRoute);private readonly api=inject(AdminModerationService);
 readonly data=signal<any|null>(null);readonly loading=signal(true);readonly error=signal('');readonly busy=signal(false);readonly id=this.route.snapshot.paramMap.get('id')||'';
 ngOnInit():void{this.load();}
 load():void{this.loading.set(true);this.error.set('');this.api.getFeedback(this.id).pipe(finalize(()=>this.loading.set(false))).subscribe({next:v=>this.data.set(v),error:()=>this.error.set('Không thể tải chi tiết phản hồi.')});}
 actionLabel():string{const s=String(this.data()?.status||'NEW');if(s==='NEW'||s==='READ')return'Bắt đầu xử lý';if(s==='PROCESSING'||s==='NEED_CONTACT')return'Đánh dấu đã xử lý';return'Đã xử lý';}
 canAction():boolean{return ['NEW','READ','PROCESSING','NEED_CONTACT'].includes(String(this.data()?.status||''));}
 process():void{const d=this.data();if(!d||!this.canAction()||this.busy())return;const current=String(d.status||'NEW');const next=['NEW','READ'].includes(current)?'PROCESSING':'PROCESSED';this.busy.set(true);this.api.updateFeedback(this.id,next).pipe(finalize(()=>this.busy.set(false))).subscribe({next:v=>this.data.set(v),error:()=>this.error.set('Không thể cập nhật trạng thái phản hồi.')});}
 statusLabel(v:string):string{return ({NEW:'Mới',READ:'Đã đọc',PROCESSING:'Đang xử lý',PROCESSED:'Đã xử lý',NEED_CONTACT:'Cần liên hệ',REJECTED:'Từ chối'} as Record<string,string>)[v]??v;}
 date(v:any):string{if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('vi-VN');}
}
