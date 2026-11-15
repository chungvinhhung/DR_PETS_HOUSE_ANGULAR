import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { finalize, Observable } from 'rxjs';

import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { AdminDataStateComponent } from '../../../../shared/admin-data-state/admin-data-state.component';
import { adminErrorMessage } from '../../../../shared/services/admin-toast.service';
import { adminPageWindowWithEdges } from '../../../../shared/utils/admin-table-pagination';
import { canAdmin } from '../../../../core/guards/admin-role-policy';
import { AdminContentService } from '../services/admin-content.service';
import { FIRST_AID_CATEGORIES } from '../../../../shared/customer/data/first-aid-data';
import { COMMUNITY_POST_TYPE_LABELS } from '../../../../shared/customer/data/community-post-types';
import { RESCUE_PARTNERS } from '../../../customer/rescue/data/rescue-data';

type ContentMode='articles'|'first-aid'|'community'|'rescue'|'adoptions';

@Component({
 selector:'app-admin-content-list',standalone:true,
 imports:[CommonModule,FormsModule,RouterLink,AdminCatalogShellComponent,AdminDataStateComponent],
 templateUrl:'./admin-content-list.component.html',
 styleUrl:'./admin-content-list.component.scss',
 changeDetection:ChangeDetectionStrategy.OnPush,
})
export class AdminContentListComponent{
 private readonly route=inject(ActivatedRoute);private readonly router=inject(Router);private readonly api=inject(AdminContentService);private readonly session=inject(AuthSessionService);
 readonly mode=this.route.snapshot.data['contentMode'] as ContentMode;
 readonly rows=signal<any[]>([]);readonly loading=signal(true);readonly error=signal('');readonly search=signal('');readonly filter=signal('');readonly status=signal('');readonly page=signal(1);readonly notice=signal('');
 readonly communityDialog=signal<any|null>(null);readonly rejectionReason=signal('');readonly rejecting=signal(false);readonly confirmCommunityDelete=signal(false);readonly communityError=signal('');readonly actionBusy=signal(false);
 readonly editorDialog=signal<'post'|'rescue'|null>(null);readonly editing=signal<any|null>(null);
 readonly editorError=signal('');
 readonly postDraft=signal({title:'',category:'',excerpt:'',content:'',status:'DRAFT',emergencyPhone:'1900-PET-HELP'});
 readonly rescueDraft=signal({petName:'',species:'DOG',breed:'',ageDescription:'',healthStatus:'',rescueStory:'',status:'LOOKING_FOR_HOME'});
 readonly pageSize=7;
 readonly adoptionPeriod=signal<'7'|'30'|'90'|'ALL'>('30');
 readonly communityTypes=COMMUNITY_POST_TYPE_LABELS;
 readonly hasCommunityTypes=computed(()=>this.rows().some(row=>this.communityTypes.some(type=>type===this.communityType(row))));
 readonly title=({articles:'Bài viết kiến thức','first-aid':'Cẩm nang sơ cứu',community:'Bài đăng cộng đồng',rescue:'Cứu trợ & Nhận nuôi',adoptions:'Đơn đăng ký nhận nuôi'} as Record<ContentMode,string>)[this.mode];
 readonly activeItem=({articles:'content-articles','first-aid':'content-first-aid',community:'content-community',rescue:'content-rescue',adoptions:'content-rescue'} as const)[this.mode];
 readonly isAdmin=computed(()=>this.session.user()?.systemRole==='ADMIN');
 readonly canWriteContent=computed(()=>canAdmin(this.session.user(),'content.manage'));
 readonly canManageRescue=computed(()=>canAdmin(this.session.user(),'rescue.manage'));
 readonly canModerateCommunity=computed(()=>canAdmin(this.session.user(),'community.moderate'));
 readonly canCreate=computed(()=>this.mode==='rescue' ? this.canManageRescue()
   : (this.mode==='articles'||this.mode==='first-aid') ? this.canWriteContent()
   : this.mode==='community' && this.isAdmin());
 readonly postCategories=computed(()=>this.mode==='first-aid'
  ? FIRST_AID_CATEGORIES.filter(c=>c.id!=='all').map(c=>c.label)
  : [...new Set(this.rows()
     .map(row=>this.postCategory(row))
     .filter((category): category is string=>Boolean(category)))]
     .sort((left,right)=>left.localeCompare(right,'vi')));
 private postCategory(row:any):string {
  const raw=row?.category;
  const label=typeof raw==='string'?raw.trim():String(raw?.name??raw?.label??raw?.category_name??'').trim();
  if(this.mode==='first-aid') {
   return FIRST_AID_CATEGORIES.find(item=>item.id===label||item.label===label)?.label || label;
  }
  return label;
 }
 urgencyLabel(row:any):string {
  const value=String(row?.urgencyLevel||row?.urgency_level||row?.severity||'').toUpperCase();
  if(row?.urgent===true||['URGENT','HIGH','EMERGENCY'].includes(value))return 'Khẩn cấp';
  if(row?.urgent===false||['NORMAL','LOW','MEDIUM'].includes(value))return 'Thông thường';
  return '—';
 }
 readonly filtered=computed(()=>{
  const q=this.search().trim().toLocaleLowerCase('vi');
  const selected=this.filter();
  return this.rows().filter(row=>{
    const text=JSON.stringify(row).toLocaleLowerCase('vi');
    const categoryMatches=!selected || (
      this.mode==='rescue'
        ? String(row.species??'').toUpperCase()===selected
        : (this.mode==='articles'||this.mode==='first-aid')
          ? this.postCategory(row).toLocaleLowerCase('vi')===selected.toLocaleLowerCase('vi')
          : this.mode==='community'
            ? this.communityType(row).toLocaleLowerCase('vi')===selected.toLocaleLowerCase('vi')
            : true
    );
    const period=this.adoptionPeriod();
    const periodMatches=this.mode!=='adoptions'||period==='ALL'||(()=>{
      const raw=row.createdAt||row.created_at;
      if(!raw)return false;
      const created=new Date(raw).getTime();
      return Number.isFinite(created)&&created<=Date.now() &&
        Date.now()-created<=Number(period)*24*60*60*1000;
    })();
    return (!q||text.includes(q)) && categoryMatches && periodMatches &&
      (!this.status() || (this.mode==='community'
        ? this.communityStatus(row)===this.status()
        : String(row.status??row.visibility??'').toUpperCase()===this.status()));
  });
 });
 readonly totalPages=computed(()=>Math.max(1,Math.ceil(this.filtered().length/this.pageSize)));
 readonly pageNumbers=computed(()=>adminPageWindowWithEdges(this.page(),this.totalPages()));
 readonly visible=computed(()=>this.filtered().slice((this.page()-1)*this.pageSize,this.page()*this.pageSize));
 ngOnInit():void{
  const notice=this.route.snapshot.queryParamMap.get('notice');
  if (['Đã lưu bản nháp bài viết.','Đã xuất bản bài viết.','Đã lưu bản nháp cẩm nang.','Đã xuất bản cẩm nang.','Đã lưu bản nháp bài đăng.','Đã đăng bài cộng đồng.','Đã cập nhật hồ sơ cứu trợ.','Đã tạo hồ sơ cứu trợ.'].includes(notice||'')) this.notice.set(notice||'');
  this.load();
 }
 load():void{
  this.loading.set(true);this.error.set('');
  let request:Observable<any[]>;
  switch(this.mode){case'articles':request=this.api.listArticles();break;case'first-aid':request=this.api.listFirstAid();break;case'community':request=this.api.listCommunity();break;case'rescue':request=this.api.listRescuePets();break;default:request=this.api.listAdoptionRequests();}
  request.pipe(finalize(()=>this.loading.set(false))).subscribe({next:rows=>this.rows.set(rows),error:()=>this.error.set('Đã có lỗi xảy ra khi tải dữ liệu. Vui lòng thử lại.')});
 }
 onFilter():void{this.page.set(1);} goToPage(p:number):void{this.page.set(Math.max(1,Math.min(p,this.totalPages())));}
 openCreate():void{
  if (!this.canCreate()) return;
  if(this.mode==='articles') {
   void this.router.navigate(['/admin/content/articles/new']);
   return;
  }
  if(this.mode==='first-aid') {
   void this.router.navigate(['/admin/content/first-aid/new']);
   return;
  }
  if(this.mode==='rescue'){
   void this.router.navigate(['/admin/content/rescue/new']);return;
  }
 }
 openEdit(row:any):void{
  if ((this.mode==='articles'||this.mode==='first-aid')&&!this.canWriteContent())return;
  if(this.mode==='rescue'&&!this.canManageRescue())return;
  if(this.mode==='articles') {
   const id=String(row?._id||row?.id||row?.post_id||'');
   if(!id){this.notice.set('Bài viết chưa có mã để chỉnh sửa. Vui lòng tải lại danh sách.');return;}
   void this.router.navigate(['/admin/content/articles',id,'edit']);
   return;
  }
  if(this.mode==='first-aid'){
   const id=String(row?._id||row?.guide_id||row?.post_id||row?.id||'');
   if(!id){this.notice.set('Cẩm nang chưa có mã để chỉnh sửa. Vui lòng tải lại danh sách.');return;}
   void this.router.navigate(['/admin/content/first-aid',id,'edit']);
   return;
  }
  if(this.mode==='rescue'){
   const id=String(row?._id||row?.id||'');
   if(!id){this.notice.set('Không tìm thấy mã hồ sơ cần chỉnh sửa.');return;}
   void this.router.navigate(['/admin/content/rescue',id,'edit']);return;
  }
 }
 updatePostDraft(field:'title'|'category'|'excerpt'|'content'|'status'|'emergencyPhone',value:string):void{
  this.postDraft.update(current=>({...current,[field]:value}));
 }
 updateRescueDraft(field:'petName'|'species'|'breed'|'ageDescription'|'healthStatus'|'rescueStory'|'status',value:string):void{
  this.rescueDraft.update(current=>({...current,[field]:value}));
 }
 closeEditor():void{if(this.actionBusy())return;this.editorDialog.set(null);this.editing.set(null);this.editorError.set('');}
 saveEditor():void{
  if (this.editorDialog()==='rescue'&&!this.canManageRescue())return;
  if(this.editorDialog()==='post'&&!this.canWriteContent())return;
  if(this.actionBusy())return;
  const editing=this.editing();const id=String(editing?._id||editing?.id||'');
  if(this.editorDialog()==='post'){
   const d=this.postDraft();
   if(!d.title.trim()||!d.category.trim()||!d.content.trim()){this.editorError.set('Vui lòng nhập đầy đủ tiêu đề, chủ đề và nội dung.');return;}
   const body:any={...d,title:d.title.trim(),category:d.category.trim(),excerpt:d.excerpt.trim(),content:d.content.trim(),
    postType:this.mode==='first-aid'?'FIRST_AID':'OFFICIAL_BLOG'};
   this.actionBusy.set(true);this.editorError.set('');
   const req=id?this.api.updatePost(id,body):this.api.createPost(body);
   req.pipe(finalize(()=>this.actionBusy.set(false))).subscribe({
    next:updated=>{
     if(id)this.rows.update(rows=>rows.map(r=>String(r?._id||r?.id)===id?{...r,...updated}:r));else this.rows.update(rows=>[updated,...rows]);
     if(id&&d.status&&String(editing?.status||'')!==d.status){
      this.api.updatePostStatus(id,d.status as 'DRAFT'|'PUBLISHED'|'ARCHIVED').subscribe({next:()=>{},error:()=>{}});
     }
     this.editorDialog.set(null);this.editing.set(null);this.editorError.set('');this.notice.set(id?'Đã cập nhật nội dung.':'Đã tạo nội dung mới.');
    },
    error:()=>this.editorError.set(id?'Không thể cập nhật nội dung. Vui lòng thử lại.':'Không thể tạo nội dung. Vui lòng thử lại.'),
   });return;
  }
  if(this.editorDialog()==='rescue'){
   const d=this.rescueDraft();
   if(!d.petName.trim()||!d.breed.trim()||!d.ageDescription.trim()||!d.healthStatus.trim()||!d.rescueStory.trim()){
    this.editorError.set('Vui lòng nhập đầy đủ thông tin bắt buộc của bé.');return;
   }
   this.actionBusy.set(true);this.editorError.set('');
   const req=id?this.api.updateRescuePet(id,d):this.api.createRescuePet(d);
   req.pipe(finalize(()=>this.actionBusy.set(false))).subscribe({
    next:updated=>{if(id)this.rows.update(rows=>rows.map(r=>String(r?._id||r?.id)===id?{...r,...updated}:r));else this.rows.update(rows=>[updated,...rows]);this.editorDialog.set(null);this.editing.set(null);this.editorError.set('');this.notice.set(id?'Đã cập nhật hồ sơ cứu trợ.':'Đã thêm hồ sơ cứu trợ.');},
    error:()=>this.editorError.set(id?'Không thể cập nhật hồ sơ. Vui lòng thử lại.':'Không thể tạo hồ sơ. Vui lòng thử lại.'),
   });
  }
 }
 deleteRow(row:any):void{
  if ((this.mode==='articles'||this.mode==='first-aid')&&!this.canWriteContent())return;
  if (this.mode==='rescue'&&!this.canManageRescue())return;
  if (this.mode==='community'&&!this.canModerateCommunity())return;
  const id=String(row?._id||row?.id||'');if(!id||this.actionBusy())return;
  if(this.mode==='community') {
   if(!this.communityCanDelete(row) || !this.confirmCommunityDelete() ||
      String(this.communityDialog()?._id||this.communityDialog()?.id||'')!==id) {
     this.communityError.set('Chỉ có thể xóa bài đăng đã duyệt, đã từ chối hoặc đã ẩn.');return;
   }
  }
  if(typeof window!=='undefined' && !(this.mode==='community' && this.confirmCommunityDelete()) && !window.confirm('Bạn có chắc muốn xóa nội dung này?'))return;
  this.actionBusy.set(true);this.notice.set('');
  const req=this.mode==='rescue'?this.api.deleteRescuePet(id):(this.mode==='community'?this.api.deleteCommunity(id):this.api.deletePost(id));
  req.pipe(finalize(()=>this.actionBusy.set(false))).subscribe({
   next:()=>{this.rows.update(rows=>rows.filter(r=>String(r?._id||r?.id)!==id));if(this.mode==='community'){this.communityDialog.set(null);this.rejecting.set(false);this.confirmCommunityDelete.set(false);this.communityError.set('');}this.notice.set('Đã xóa nội dung.');},
   error:(err:unknown)=>{const message=adminErrorMessage(err,'Không thể xóa nội dung. Vui lòng thử lại.');if(this.mode==='community'&&this.communityDialog())this.communityError.set(message);else this.notice.set(message);},
  });
 }
 openCommunity(r:any):void{
   this.communityDialog.set(r);this.rejectionReason.set('');
   this.rejecting.set(false);
   this.confirmCommunityDelete.set(false);this.communityError.set('');this.notice.set('');
 }
 closeCommunity():void{
   if(this.actionBusy())return;
   this.communityDialog.set(null);this.rejectionReason.set('');
   this.rejecting.set(false);
   this.confirmCommunityDelete.set(false);this.communityError.set('');
 }
 startCommunityRejection():void {
   this.confirmCommunityDelete.set(false);
   this.communityError.set('');this.rejecting.set(true);
 }
 communityIsPending(row:any):boolean {
   return String(row?.status ?? '').toUpperCase()==='PENDING';
 }
 communityIsApproved(row:any):boolean {
   return String(row?.status ?? '').toUpperCase()==='APPROVED';
 }
 communityCanDelete(row:any):boolean {
   // Pending posts must be rejected (reason retained), not permanently deleted.
   const status=String(row?.status ?? '').toUpperCase();
   return this.canModerateCommunity() && (status==='REJECTED' || status==='HIDDEN' || status==='APPROVED');
 }
 startCommunityDeletion():void {
   if(!this.communityCanDelete(this.communityDialog()))return;
   this.rejecting.set(false);
   this.communityError.set('');this.confirmCommunityDelete.set(true);
 }
 cancelCommunityAction():void {
   this.rejecting.set(false);
   this.confirmCommunityDelete.set(false);this.communityError.set('');
 }
 isCommunityPublic(row:any):boolean {
   return String(row?.status || '').toUpperCase()==='APPROVED' && Boolean(row?._id || row?.id);
 }
 communityPostPublicUrl(row:any):string {
   const id=String(row?._id || row?.id || '').trim();
   return 'https://drpetshouse.lat/bai-viet/cong-dong?postId='+encodeURIComponent(id);
 }
 moderateCommunity(status:'APPROVED'|'REJECTED'|'HIDDEN'):void{
  const row=this.communityDialog();const id=String(row?._id||row?.id||'');
  if(!id||this.actionBusy())return;
  if(status==='REJECTED'&&this.rejectionReason().trim().length<3){
   this.communityError.set('Vui lòng nhập lý do từ chối ít nhất 3 ký tự.');return;
  }
  this.actionBusy.set(true);this.communityError.set('');
  this.api.moderateCommunity(id,status,this.rejectionReason()).pipe(finalize(()=>this.actionBusy.set(false))).subscribe({
   next:updated=>{
    const actual=String(updated?.status||'').toUpperCase();
    if(actual && actual!==status) {
      this.communityError.set('BE chưa xác nhận trạng thái kiểm duyệt chính xác. Vui lòng tải lại dữ liệu.');return;
    }
    this.rows.update(rows=>rows.map(item=>String(item?._id||item?.id)===id?{...item,...updated,status}:item));
    this.communityDialog.set(null);this.rejectionReason.set('');this.rejecting.set(false);this.confirmCommunityDelete.set(false);
    this.notice.set(status==='APPROVED'?'Đã duyệt bài đăng.':status==='HIDDEN'?'Đã ẩn bài đăng.':'Đã từ chối bài đăng.');
   },
   error:(err:unknown)=>this.communityError.set(adminErrorMessage(err,'Không thể cập nhật trạng thái bài đăng. Vui lòng thử lại.')),
  });
 }
 name(r:any):string{return r.title||r.name||r.petName||r.pet_name||r.content||r.message||'—';}
 communityType(r:any):string {
  const raw=r?.type ?? r?.postType ?? r?.category ?? r?.post_type;
  if(!raw)return '';
  const value=(typeof raw==='string'?raw:String(raw?.label||raw?.name||'')).trim();
  // Normalize casing for real persisted Customer tags, without fabricating
  // categories for old records whose type was not stored by BE.
  return this.communityTypes.find(label=>label.toLocaleLowerCase('vi')===value.toLocaleLowerCase('vi')) ?? value;
 }
 communityStatus(r:any):string {
  const value=String(r?.status||r?.visibility||'').toUpperCase();
  const reported=Number(r?.reportCount??r?.reportsCount??0)>0 || r?.isReported===true || value==='REPORTED';
  return reported && value!=='HIDDEN' ? 'REPORTED' : value;
 }
 category(r:any):string{
  if(this.mode==='community')return this.communityType(r)||'—';
  return r.category?.label||r.category?.name||r.category||r.group||r.species||r.type||'—';
 }
 author(r:any):string{return r.authorCustomerId?.fullName||r.authorId?.fullName||r.author?.fullName||r.author?.name||r.authorNameSnapshot||r.authorName||r.displayName||r.ownerName||'—';}
 date(r:any):string{const v=(this.mode==='rescue'||this.mode==='adoptions')?(r.createdAt||r.created_at):(r.updatedAt||r.publishedAt||r.createdAt||r.created_at); if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleDateString('vi-VN');}
 statusLabel(r:any):string{const v=this.mode==='community'?this.communityStatus(r):String(r.status||r.visibility||'PUBLISHED').toUpperCase();if(this.mode==='community'&&v==='APPROVED')return 'Bình thường';return ({PUBLISHED:'Đã xuất bản',ARCHIVED:'Đã lưu trữ',ACTIVE:'Đã xuất bản',DRAFT:'Bản nháp',HIDDEN:'Ẩn',NORMAL:'Bình thường',REPORTED:'Bị báo cáo',AVAILABLE:'Còn chờ',LOOKING_FOR_HOME:'Còn chờ',ADOPTED:'Đã có tổ ấm',PENDING:'Chờ duyệt',UNDER_REVIEW:'Đang xem xét',APPROVED:'Đã duyệt',REJECTED:'Từ chối'} as Record<string,string>)[v]??v;}
 statusClass(r:any):string{const v=this.mode==='community'?this.communityStatus(r):String(r.status||r.visibility||'PUBLISHED').toUpperCase();return /HIDDEN|REJECTED|REPORTED/.test(v)?'danger':/DRAFT|PENDING|ARCHIVED/.test(v)?'pending':/UNDER_REVIEW/.test(v)?'info':'success';}
 rescueSpecies(r:any):string{
  return ({DOG:'Chó',CAT:'Mèo',OTHER:'Khác'} as Record<string,string>)[String(r?.species||'').toUpperCase()]||String(r?.species||'—');
 }
 rescueArea(r:any):string{
  const partner=RESCUE_PARTNERS.find(p=>p.id===String(r?.supportPartnerId||''));
  return partner?.region||'—';
 }
 rescuePartnerName(r:any):string{
  return RESCUE_PARTNERS.find(p=>p.id===String(r?.supportPartnerId||''))?.name||'Chưa chọn đối tác';
 }
 rescueCondition(r:any):string{return r.healthStatus||r.condition||'—';}
 adoptionCode(r:any):string{return r.requestCode||r.code||r.id||r._id||'—';}
 adoptionApplicant(r:any):string{return r.applicantInfo?.fullName||r.applicantName||r.name||'—';}
 adoptionPet(r:any):string{return r.rescuePetId?.petName||r.petName||'—';}
 adoptionHousing(r:any):string{return r.applicantInfo?.housingType||r.housingType||'—';}
 adoptionAloneTime(r:any):string{return r.aloneTime||r.applicantInfo?.aloneTime||'—';}
 likes(r:any):number{return Number(r.likesCount??r.likes??0);} comments(r:any):number{return Number(r.commentsCount??r.comments??0);}
}
