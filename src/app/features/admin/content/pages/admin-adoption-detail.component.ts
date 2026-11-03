import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminBreadcrumbComponent } from '../../../../shared/admin-breadcrumb/admin-breadcrumb.component';
import { AdminDataStateComponent } from '../../../../shared/admin-data-state/admin-data-state.component';
import { AdminContentService } from '../services/admin-content.service';

@Component({
 selector:'app-admin-adoption-detail',
 standalone:true,
 imports:[RouterLink,AdminCatalogShellComponent,AdminBreadcrumbComponent,AdminDataStateComponent],
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

 review(status:'APPROVED'|'REJECTED'):void{
  const d=this.data();const id=String(d?._id||d?.id||this.id);
  if(!id||this.busy()||String(d?.status||'').toUpperCase()!=='PENDING')return;
  this.busy.set(true);this.actionError.set('');
  this.api.reviewAdoptionRequest(id,status).pipe(finalize(()=>this.busy.set(false))).subscribe({
   next:updated=>this.data.set({...d,...updated}),
   error:()=>this.actionError.set(status==='APPROVED'?'Không thể duyệt đơn. Vui lòng thử lại.':'Không thể từ chối đơn. Vui lòng thử lại.'),
  });
 }

 value(...v:any[]):string{return v.find(x=>x!==undefined&&x!==null&&String(x).trim()!=='')??'—';}
 applicant(d:any):any{return d?.applicantInfo||{};}
 pet(d:any):any{return d?.rescuePetId||{};}
 statusLabel(value:any):string{return ({PENDING:'Chờ duyệt',APPROVED:'Đã duyệt',REJECTED:'Đã từ chối'} as Record<string,string>)[String(value||'').toUpperCase()]||String(value||'—');}
 isPending(d:any):boolean{return String(d?.status||'').toUpperCase()==='PENDING';}
}