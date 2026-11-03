import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, Observable, of } from 'rxjs';

import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminDataStateComponent } from '../../../../shared/admin-data-state/admin-data-state.component';
import { adminPageWindowWithEdges } from '../../../../shared/utils/admin-table-pagination';
import { AdminModerationService } from '../services/admin-moderation.service';

type Mode='reviews'|'feedback'|'reports';
@Component({selector:'app-admin-moderation-list',standalone:true,imports:[CommonModule,FormsModule,RouterLink,AdminCatalogShellComponent,AdminDataStateComponent],templateUrl:'./admin-moderation-list.component.html',styleUrl:'./admin-moderation-list.component.scss',changeDetection:ChangeDetectionStrategy.OnPush})
export class AdminModerationListComponent{
 private readonly route=inject(ActivatedRoute);private readonly api=inject(AdminModerationService);
 readonly mode=this.route.snapshot.data['moderationMode'] as Mode;readonly rows=signal<any[]>([]);readonly loading=signal(true);readonly error=signal('');readonly search=signal('');readonly filter=signal('');readonly status=signal('');readonly page=signal(1);readonly pageSize=7;
 readonly title=this.mode==='reviews'?'Đánh giá':this.mode==='feedback'?'Phản hồi khách hàng':'Báo cáo vi phạm';
 readonly activeItem=this.mode==='reviews'?'moderation-reviews':this.mode==='feedback'?'moderation-feedback':'moderation-reports';
 readonly filtered=computed(()=>{const q=this.search().trim().toLocaleLowerCase('vi');return this.rows().filter(r=>(!q||JSON.stringify(r).toLocaleLowerCase('vi').includes(q))&&(!this.status()||this.rowStatus(r)===this.status())&&(!this.filter()||String(r.rating??r.category??r.reason??'').includes(this.filter())));});
 readonly totalPages=computed(()=>Math.max(1,Math.ceil(this.filtered().length/this.pageSize)));readonly pageNumbers=computed(()=>adminPageWindowWithEdges(this.page(),this.totalPages()));readonly visible=computed(()=>this.filtered().slice((this.page()-1)*this.pageSize,this.page()*this.pageSize));
 ngOnInit():void{this.load();}
 load():void{this.loading.set(true);this.error.set('');let req:Observable<any[]>;if(this.mode==='reviews')req=this.api.listReviews();else if(this.mode==='feedback')req=this.api.listFeedback();else req=of([]);req.pipe(finalize(()=>this.loading.set(false))).subscribe({next:v=>this.rows.set(v),error:()=>this.error.set('Đã có lỗi xảy ra khi tải dữ liệu. Vui lòng thử lại.')});}
 onFilter():void{this.page.set(1);}goToPage(p:number):void{this.page.set(Math.max(1,Math.min(p,this.totalPages())));}
 rowStatus(r:any):string{if(this.mode==='reviews')return r.hidden?'HIDDEN':'ACTIVE';return String(r.status||'NEW').toUpperCase();}
 statusLabel(r:any):string{const v=this.rowStatus(r);return ({ACTIVE:'Hiển thị',HIDDEN:'Ẩn',NEW:'Mới',READ:'Đã đọc',PROCESSING:'Đang xử lý',PROCESSED:'Đã xử lý',NEED_CONTACT:'Cần liên hệ',REJECTED:'Từ chối',PENDING:'Chờ xử lý',UNDER_REVIEW:'Đang xem xét',NO_VIOLATION:'Không vi phạm'} as Record<string,string>)[v]??v;}
 statusKind(r:any):string{const v=this.rowStatus(r);return /HIDDEN|REJECTED/.test(v)?'danger':/NEW|PENDING/.test(v)?'pending':/PROCESSING|UNDER_REVIEW|NEED_CONTACT/.test(v)?'info':'success';}
 date(v:any):string{if(!v)return'—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('vi-VN');}
 reviewName(r:any):string{return r.targetName||r.title||r.targetType==='SERVICE'?'Dịch vụ':'Sản phẩm';}
}
