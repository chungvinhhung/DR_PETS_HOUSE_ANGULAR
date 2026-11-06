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
type Period='7'|'30'|'90'|'ALL';

@Component({
 selector:'app-admin-moderation-list',standalone:true,
 imports:[CommonModule,FormsModule,RouterLink,AdminCatalogShellComponent,AdminDataStateComponent],
 templateUrl:'./admin-moderation-list.component.html',
 styleUrl:'./admin-moderation-list.component.scss',
 changeDetection:ChangeDetectionStrategy.OnPush
})
export class AdminModerationListComponent {
 private readonly route=inject(ActivatedRoute);
 private readonly api=inject(AdminModerationService);
 readonly mode=this.route.snapshot.data['moderationMode'] as Mode;
 readonly rows=signal<any[]>([]);
 readonly loading=signal(true);
 readonly error=signal('');
 readonly notice=signal('');
 readonly search=signal('');
 readonly filter=signal('');
 readonly status=signal('');
 readonly period=signal<Period>('30');
 readonly page=signal(1);
 readonly pageSize=7;
 readonly busy=signal(false);
 readonly reviewDialog=signal<any|null>(null);
 readonly reviewReason=signal('');
 readonly reviewError=signal('');
 readonly confirmHide=signal(false);
 readonly title=this.mode==='reviews'?'Đánh giá':this.mode==='feedback'?'Phản hồi khách hàng':'Báo cáo vi phạm';
 readonly activeItem=this.mode==='reviews'?'moderation-reviews':this.mode==='feedback'?'moderation-feedback':'moderation-reports';

 readonly filtered=computed(()=>{
  const q=this.search().trim().toLocaleLowerCase('vi');
  const status=this.status(), rating=this.filter(), period=this.period();
  const now=Date.now();
  return this.rows().filter(r=>{
   const text=this.mode==='reviews'
    ? [r.targetName,r.targetId,r.displayName,r.comment,r.sourceId].join(' ')
    : this.mode==='feedback'
      ? [r.name,r.email,r.phone,r.subject,r.message].join(' ')
      : [r.reporterName,r.postTitle,r.reason].join(' ');
   const matchesSearch=!q||text.toLocaleLowerCase('vi').includes(q);
   const matchesStatus=!status||this.rowStatus(r)===status;
   const matchesRating=this.mode!=='reviews'||!rating
     ||(rating==='3' ? Number(r.rating)<=3 : Number(r.rating)===Number(rating));
   const matchesCategory=this.mode!=='reports'||!rating||String(r.reason||'')===rating;
   const created=new Date(r.createdAt||r.created_at||'').getTime();
   const matchesPeriod=period==='ALL'||(
      Number.isFinite(created)&&created<=now&&now-created<=Number(period)*86400000
   );
   return matchesSearch&&matchesStatus&&matchesRating&&matchesCategory&&matchesPeriod;
  });
 });
 readonly totalPages=computed(()=>Math.max(1,Math.ceil(this.filtered().length/this.pageSize)));
 readonly pageNumbers=computed(()=>adminPageWindowWithEdges(this.page(),this.totalPages()));
 readonly visible=computed(()=>this.filtered().slice((this.page()-1)*this.pageSize,this.page()*this.pageSize));
 ngOnInit():void{this.load();}
 load():void {
  this.loading.set(true);this.error.set('');this.notice.set('');
  const req:Observable<any[]>=this.mode==='reviews'
    ?this.api.listReviews():this.mode==='feedback'?this.api.listFeedback():of([]);
  req.pipe(finalize(()=>this.loading.set(false))).subscribe({
   next:rows=>{this.rows.set(rows);this.page.set(1);},
   error:err=>this.error.set(err?.error?.message||'Không thể tải dữ liệu từ Backend. Vui lòng thử lại.')
  });
 }
 onFilter():void{this.page.set(1);}
 goToPage(value:number):void{this.page.set(Math.max(1,Math.min(value,this.totalPages())));}
 rowStatus(r:any):string {
  if(this.mode==='reviews')return r.hidden||String(r.status||'').toUpperCase()==='HIDDEN'?'HIDDEN':'ACTIVE';
  return String(r.status||'NEW').toUpperCase();
 }
 statusLabel(r:any):string {
  const s=this.rowStatus(r);
  return ({ACTIVE:'Hiển thị',HIDDEN:'Ẩn',NEW:'Mới',READ:'Đã đọc',
   PROCESSING:'Đang xử lý',PROCESSED:'Đã xử lý',NEED_CONTACT:'Cần liên hệ',
   REJECTED:'Từ chối',PENDING:'Chờ xử lý',UNDER_REVIEW:'Đang xem xét',
   NO_VIOLATION:'Không vi phạm'} as Record<string,string>)[s]||s;
 }
 statusKind(r:any):string{
  const s=this.rowStatus(r);
  return /HIDDEN|REJECTED/.test(s)?'danger':/NEW|PENDING/.test(s)?'pending':
   /PROCESSING|UNDER_REVIEW|NEED_CONTACT/.test(s)?'info':'success';
 }
 date(value:any):string {
  if(!value)return '—';
  const parsed=new Date(value);
  return Number.isNaN(parsed.getTime())?'—':parsed.toLocaleDateString('vi-VN');
 }
 reviewName(r:any):string{return r.targetName||r.title||(r.targetType==='SERVICE'?'Đánh giá dịch vụ':'Đánh giá sản phẩm');}
 reviewReference(r:any):string {
  // Backend currently omits sourceType/sourceId. Never invent an order/appointment code.
  return r.referenceCode||r.sourceCode||r.sourceId||'—';
 }
 openReview(row:any):void{
  this.reviewDialog.set(row);this.reviewReason.set('');this.reviewError.set('');
  this.confirmHide.set(false);
 }
 closeReview():void {
  if(this.busy())return;
  this.reviewDialog.set(null);this.reviewReason.set('');this.reviewError.set('');
  this.confirmHide.set(false);
 }
 hideReview():void {
  const row=this.reviewDialog(),id=String(row?.id||row?._id||'');
  if(!row||!id||this.busy())return;
  if(this.reviewReason().trim().length<3){
   this.reviewError.set('Vui lòng nhập lý do ẩn đánh giá ít nhất 3 ký tự.');return;
  }
  this.busy.set(true);this.reviewError.set('');
  this.api.hideReview(id,this.reviewReason().trim())
   .pipe(finalize(()=>this.busy.set(false))).subscribe({
    next:updated=>{
      this.rows.update(rows=>rows.map(r=>String(r.id||r._id)===id?{...r,...updated,hidden:true}:r));
      this.reviewDialog.set(null);this.confirmHide.set(false);this.reviewReason.set('');this.notice.set('Đã ẩn đánh giá khỏi Customer.');
    },
    error:err=>this.reviewError.set(err?.error?.message||'Không thể ẩn đánh giá.')
   });
 }
 showReview():void {
  const row=this.reviewDialog(),id=String(row?.id||row?._id||'');
  if(!row||!id||this.busy())return;
  this.busy.set(true);this.reviewError.set('');
  this.api.showReview(id).pipe(finalize(()=>this.busy.set(false))).subscribe({
   next:updated=>{
     this.rows.update(rows=>rows.map(r=>String(r.id||r._id)===id?{...r,...updated,hidden:false}:r));
     this.reviewDialog.set(null);this.confirmHide.set(false);this.reviewReason.set('');this.notice.set('Đã hiển thị lại đánh giá.');
   },
   error:err=>this.reviewError.set(err?.error?.message||'Không thể hiển thị lại đánh giá.')
  });
 }
}
