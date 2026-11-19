import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, Observable, of } from 'rxjs';

import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminDataStateComponent } from '../../../../shared/admin-data-state/admin-data-state.component';
import { AdminDateRangeComponent, type AdminDateRange } from '../../../../shared/admin-date-range/admin-date-range.component';
import { adminPageWindowWithEdges } from '../../../../shared/utils/admin-table-pagination';
import { AdminModerationService } from '../services/admin-moderation.service';

type Mode='reviews'|'feedback'|'reports';

@Component({
 selector:'app-admin-moderation-list',standalone:true,
 imports:[CommonModule,FormsModule,RouterLink,AdminCatalogShellComponent,AdminDataStateComponent,AdminDateRangeComponent],
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
 readonly reviewType=signal('');
 readonly status=signal('');
 readonly dateFrom=signal('');
 readonly dateTo=signal('');
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
  const status=this.status(), rating=this.filter(), type=this.reviewType();
  const start=this.dateFrom(), end=this.dateTo();
  return this.rows().filter(r=>{
   const text=this.mode==='reviews'
    ? [r.targetName,r.targetId,r.displayName,r.comment,r.sourceId,r.referenceCode].join(' ')
    : this.mode==='feedback'
      ? [r.name,r.email,r.phone,r.subject,r.message].join(' ')
      : [r.reporterName,r.postTitle,r.reason].join(' ');
   const matchesSearch=!q||text.toLocaleLowerCase('vi').includes(q);
   const matchesStatus=!status||this.rowStatus(r)===status;
   const matchesReviewType=this.mode!=='reviews'||!type
     ||String(r.targetType||'').toUpperCase()===type;
   const matchesRating=this.mode!=='reviews'||!rating
     ||(rating==='3' ? Number(r.rating)<=3 : Number(r.rating)===Number(rating));
   const matchesCategory=this.mode!=='reports'||!rating||String(r.reason||'')===rating;
   // Use the local calendar date so an ISO timestamp near midnight is
   // included on the expected date. The range includes both endpoints.
   const raw=r.createdAt||r.created_at;
   const created=raw?new Date(raw):null;
   const day=created&&!Number.isNaN(created.getTime())
     ? [created.getFullYear(),String(created.getMonth()+1).padStart(2,'0'),
        String(created.getDate()).padStart(2,'0')].join('-'):'';
   const matchesDate=(!start&&!end)
      ||(!!day&&(!start||day>=start)&&(!end||day<=end));
   return matchesSearch&&matchesStatus&&matchesRating&&matchesCategory&&matchesReviewType&&matchesDate;
  });
 });
 readonly totalPages=computed(()=>Math.max(1,Math.ceil(this.filtered().length/this.pageSize)));
 readonly pageNumbers=computed(()=>adminPageWindowWithEdges(this.page(),this.totalPages()));
 readonly visible=computed(()=>this.filtered().slice((this.page()-1)*this.pageSize,this.page()*this.pageSize));
 ngOnInit():void{this.load();}
 load():void {
  this.loading.set(true);this.error.set('');this.notice.set('');
  const req:Observable<any[]>=this.mode==='reviews'
    ?this.api.listReviews():this.mode==='feedback'?this.api.listFeedback():this.api.listReports();
  req.pipe(finalize(()=>this.loading.set(false))).subscribe({
   next:rows=>{this.rows.set(rows);this.page.set(1);},
   error:err=>this.error.set('Không thể tải dữ liệu lúc này. Vui lòng thử lại sau.')
  });
 }
 onFilter():void{this.page.set(1);}
 onDateRangeChange(value:AdminDateRange):void{
  this.dateFrom.set(value.from);
  this.dateTo.set(value.to);
  this.onFilter();
 }
 goToPage(value:number):void{this.page.set(Math.max(1,Math.min(value,this.totalPages())));}
 rowStatus(r:any):string {
  if(this.mode==='reviews')return r.hidden||String(r.status||'').toUpperCase()==='HIDDEN'?'HIDDEN':'ACTIVE';
  return String(r.status||(this.mode==='reports'?'PENDING':'NEW')).toUpperCase();
 }
 statusLabel(r:any):string {
  const s=this.rowStatus(r);
  return ({ACTIVE:'Hiển thị',HIDDEN:'Ẩn',NEW:'Mới',READ:'Đã đọc',
   PROCESSING:'Đang xử lý',PROCESSED:'Đã xử lý',NEED_CONTACT:'Cần liên hệ',
   REJECTED:'Từ chối',PENDING:'Chờ xử lý',UNDER_REVIEW:'Đang xem xét',
   RESOLVED:'Đã xử lý',NO_VIOLATION:'Không vi phạm'} as Record<string,string>)[s]||s;
 }
 statusKind(r:any):string{
  const s=this.rowStatus(r);
  return /HIDDEN|REJECTED/.test(s)?'danger':/NEW|PENDING/.test(s)?'pending':
   /PROCESSING|UNDER_REVIEW|NEED_CONTACT/.test(s)?'info':'success';
 }
 reportReasonLabel(reason: string): string {
  const map: Record<string, string> = {
    SPAM: 'Spam / quảng cáo',
    MISINFORMATION: 'Thông tin sai lệch',
    INAPPROPRIATE: 'Nội dung không phù hợp',
    HARASSMENT: 'Quấy rối / xúc phạm',
    OTHER: 'Khác',
  };
  return map[String(reason || '').toUpperCase()] || reason || '—';
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
 reviewAuthor(r:any):string {
  return r?.anonymous===true?'Ẩn danh':String(r?.displayName||'Khách hàng');
 }
 customerReviewUrl(r:any):string {
  if(this.mode!=='reviews'||this.rowStatus(r)!=='ACTIVE'||
     String(r?.targetType||'').toUpperCase()!=='PRODUCT')return '';
  const productId=String(r?.targetId||'').trim();
  const reviewId=String(r?.id||r?._id||'').trim();
  if(!productId||!reviewId)return '';
  return '/product-details/'+encodeURIComponent(productId)
    +'?tab=reviews&reviewId='+encodeURIComponent(reviewId);
 }
 readonly ratingStars=[1,2,3,4,5] as const;
 feedbackGender(r:any):string {
  const value=String(r?.gender||'').toLowerCase();
  return ({male:'Nam',female:'Nữ',other:'Khác'} as Record<string,string>)[value]||'—';
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
      this.reviewDialog.set(null);this.confirmHide.set(false);this.reviewReason.set('');this.notice.set('Đã ẩn đánh giá khỏi trang dành cho khách hàng.');
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
