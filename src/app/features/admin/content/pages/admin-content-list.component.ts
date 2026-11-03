import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize, Observable } from 'rxjs';

import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminDataStateComponent } from '../../../../shared/admin-data-state/admin-data-state.component';
import { adminPageWindowWithEdges } from '../../../../shared/utils/admin-table-pagination';
import { AdminContentService } from '../services/admin-content.service';

type ContentMode='articles'|'first-aid'|'community'|'rescue'|'adoptions';

@Component({
 selector:'app-admin-content-list',standalone:true,
 imports:[CommonModule,FormsModule,RouterLink,AdminCatalogShellComponent,AdminDataStateComponent],
 templateUrl:'./admin-content-list.component.html',
 styleUrl:'./admin-content-list.component.scss',
 changeDetection:ChangeDetectionStrategy.OnPush,
})
export class AdminContentListComponent{
 private readonly route=inject(ActivatedRoute);private readonly api=inject(AdminContentService);
 readonly mode=this.route.snapshot.data['contentMode'] as ContentMode;
 readonly rows=signal<any[]>([]);readonly loading=signal(true);readonly error=signal('');readonly search=signal('');readonly filter=signal('');readonly status=signal('');readonly page=signal(1);readonly notice=signal('');
 readonly communityDialog=signal<any|null>(null);readonly rejectionReason=signal('');readonly actionBusy=signal(false);
 readonly pageSize=7;
 readonly title=({articles:'Bài viết / Kiến thức','first-aid':'Cẩm nang sơ cứu',community:'Bài đăng cộng đồng',rescue:'Cứu trợ & Nhận nuôi',adoptions:'Đơn đăng ký nhận nuôi'} as Record<ContentMode,string>)[this.mode];
 readonly activeItem=({articles:'content-articles','first-aid':'content-first-aid',community:'content-community',rescue:'content-rescue',adoptions:'content-rescue'} as const)[this.mode];
 readonly filtered=computed(()=>{
  const q=this.search().trim().toLocaleLowerCase('vi');
  return this.rows().filter(row=>{
    const text=JSON.stringify(row).toLocaleLowerCase('vi');
    const type=String(row.category??row.type??row.species??row.status??'');
    return (!q||text.includes(q))&&(!this.filter()||type.toLocaleLowerCase('vi').includes(this.filter().toLocaleLowerCase('vi')))&&(!this.status()||String(row.status??row.visibility??'').toUpperCase()===this.status());
  });
 });
 readonly totalPages=computed(()=>Math.max(1,Math.ceil(this.filtered().length/this.pageSize)));
 readonly pageNumbers=computed(()=>adminPageWindowWithEdges(this.page(),this.totalPages()));
 readonly visible=computed(()=>this.filtered().slice((this.page()-1)*this.pageSize,this.page()*this.pageSize));
 ngOnInit():void{this.load();}
 load():void{
  this.loading.set(true);this.error.set('');
  let request:Observable<any[]>;
  switch(this.mode){case'articles':request=this.api.listArticles();break;case'first-aid':request=this.api.listFirstAid();break;case'community':request=this.api.listCommunity();break;case'rescue':request=this.api.listRescuePets();break;default:request=this.api.listAdoptionRequests();}
  request.pipe(finalize(()=>this.loading.set(false))).subscribe({next:rows=>this.rows.set(rows),error:()=>this.error.set('Đã có lỗi xảy ra khi tải dữ liệu. Vui lòng thử lại.')});
 }
 onFilter():void{this.page.set(1);} goToPage(p:number):void{this.page.set(Math.max(1,Math.min(p,this.totalPages())));}
 unsupported(action:string):void{this.notice.set(action+' hiện chưa sẵn sàng trên giao diện quản trị.');}
 openCommunity(r:any):void{this.communityDialog.set(r);this.rejectionReason.set('');this.notice.set('');}
 closeCommunity():void{if(this.actionBusy())return;this.communityDialog.set(null);this.rejectionReason.set('');}
 moderateCommunity(status:'APPROVED'|'REJECTED'|'HIDDEN'):void{
  const row=this.communityDialog();const id=String(row?._id||row?.id||'');
  if(!id||this.actionBusy())return;
  if(status==='REJECTED'&&this.rejectionReason().trim().length<3){
   this.notice.set('Vui lòng nhập lý do từ chối ít nhất 3 ký tự.');return;
  }
  this.actionBusy.set(true);this.notice.set('');
  this.api.moderateCommunity(id,status,this.rejectionReason()).pipe(finalize(()=>this.actionBusy.set(false))).subscribe({
   next:updated=>{
    this.rows.update(rows=>rows.map(item=>String(item?._id||item?.id)===id?{...item,...updated}:item));
    this.communityDialog.set(null);this.rejectionReason.set('');
    this.notice.set(status==='APPROVED'?'Đã duyệt bài đăng.':status==='HIDDEN'?'Đã ẩn bài đăng.':'Đã từ chối bài đăng.');
   },
   error:()=>this.notice.set('Không thể cập nhật trạng thái bài đăng. Vui lòng thử lại.'),
  });
 }
 name(r:any):string{return r.title||r.name||r.petName||r.pet_name||r.content||r.message||'—';}
 category(r:any):string{if(this.mode==='community')return 'Bài chia sẻ';return r.category?.label||r.category?.name||r.category||r.group||r.species||r.type||'—';}
 author(r:any):string{return r.authorId?.fullName||r.author?.name||r.authorNameSnapshot||r.authorName||r.displayName||r.ownerName||'Dr. Pet’s House';}
 date(r:any):string{const v=r.updatedAt||r.publishedAt||r.createdAt||r.created_at; if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('vi-VN');}
 statusLabel(r:any):string{const v=String(r.status||r.visibility||'PUBLISHED').toUpperCase();return ({PUBLISHED:'Đã xuất bản',ARCHIVED:'Đã lưu trữ',ACTIVE:'Đã xuất bản',DRAFT:'Bản nháp',HIDDEN:'Ẩn',NORMAL:'Bình thường',REPORTED:'Bị báo cáo',AVAILABLE:'Còn chờ',LOOKING_FOR_HOME:'Chưa có tổ ấm',ADOPTED:'Đã có tổ ấm',PENDING:'Chờ duyệt',UNDER_REVIEW:'Đang xem xét',APPROVED:'Đã duyệt',REJECTED:'Từ chối'} as Record<string,string>)[v]??v;}
 statusClass(r:any):string{const v=String(r.status||r.visibility||'PUBLISHED').toUpperCase();return /HIDDEN|REJECTED|REPORTED/.test(v)?'danger':/DRAFT|PENDING|ARCHIVED/.test(v)?'pending':/UNDER_REVIEW/.test(v)?'info':'success';}
 rescueArea(r:any):string{return r.branchId?.name||r.area||r.location||'—';}
 rescueCondition(r:any):string{return r.healthStatus||r.condition||'—';}
 adoptionCode(r:any):string{return r.requestCode||r.code||r.id||r._id||'—';}
 adoptionApplicant(r:any):string{return r.applicantInfo?.fullName||r.applicantName||r.name||'—';}
 adoptionPet(r:any):string{return r.rescuePetId?.petName||r.petName||'—';}
 adoptionHousing(r:any):string{return r.applicantInfo?.housingType||r.housingType||'—';}
 adoptionExperience(r:any):string{return r.applicantInfo?.hasPetExperience===true?'Có kinh nghiệm':r.applicantInfo?.hasPetExperience===false?'Chưa có kinh nghiệm':r.aloneTime||'—';}
 likes(r:any):number{return Number(r.likesCount||r.likes||0);} comments(r:any):number{return Number(r.commentsCount||r.comments||0);}
}
