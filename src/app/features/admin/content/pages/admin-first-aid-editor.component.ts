import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminBreadcrumbComponent } from '../../../../shared/admin-breadcrumb/admin-breadcrumb.component';
import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { AdminContentService } from '../services/admin-content.service';
import { FIRST_AID_CATEGORIES } from '../../../../shared/customer/data/first-aid-data';
import { blogImages } from '../../../../shared/customer/assets/blog-images';
import { FirstAidCardComponent } from '../../../customer/blog/pages/first-aid/first-aid-card.component';

type AidUrgency = 'NORMAL' | 'URGENT';
type AidStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
interface AidStep { id:number; title:string; description:string; }

function backendId(row:any):string {
  return String(row?._id || row?.guide_id || row?.post_id || row?.id || '');
}
function safeHttpUrl(value:string):boolean {
  try { return ['https:', 'http:'].includes(new URL(value).protocol); }
  catch { return false; }
}

@Component({
  selector:'app-admin-first-aid-editor',
  standalone:true,
  imports:[CommonModule,FormsModule,AdminCatalogShellComponent,AdminBreadcrumbComponent,FirstAidCardComponent],
  templateUrl:'./admin-first-aid-editor.component.html',
  styleUrl:'./admin-first-aid-editor.component.scss',
  changeDetection:ChangeDetectionStrategy.OnPush,
})
export class AdminFirstAidEditorComponent {
  private readonly route=inject(ActivatedRoute);
  private readonly router=inject(Router);
  private readonly api=inject(AdminContentService);
  private readonly session=inject(AuthSessionService);
  readonly editId=this.route.snapshot.paramMap.get('id') || '';
  readonly isEditing=!!this.editId;
  readonly canWrite=computed(()=>this.session.user()?.systemRole==='ADMIN');
  readonly categories=FIRST_AID_CATEGORIES.filter(item=>item.id!=='all');

  readonly title=signal('');
  readonly category=signal('');
  readonly summary=signal('');
  readonly heroTitle=signal('');
  readonly coverUrl=signal('');
  readonly urgency=signal<AidUrgency>('NORMAL');
  readonly hotline=signal('');
  readonly steps=signal<AidStep[]>([{id:1,title:'',description:''}]);
  readonly videoUrl=signal('');
  readonly videoTitle=signal('');
  readonly videoDescription=signal('');
  readonly videoHighlights=signal('');
  readonly previewMode=signal<'CARD'|'DETAIL'>('CARD');
  readonly savedStatus=signal<AidStatus>('DRAFT');
  readonly savedId=signal(this.editId);
  readonly loading=signal(this.isEditing);
  readonly error=signal('');
  readonly loadError=signal('');
  readonly saving=signal(false);
  readonly dirty=signal(false);
  private nextStepId=2;
  private leaving=false;

  readonly breadcrumb=[
    {label:'Cẩm nang sơ cứu',link:'/admin/content/first-aid'},
    {label:this.isEditing?'Chỉnh sửa cẩm nang':'Tạo cẩm nang sơ cứu'},
  ];
  readonly categoryLabel=computed(()=>this.categories.find(c=>c.id===this.category())?.label || 'Nhóm tình huống');
  readonly completedSteps=computed(()=>this.steps().filter(s=>s.title.trim() && s.description.trim()));
  readonly videoPoints=computed(()=>this.videoHighlights().split(/\r?\n/).map(v=>v.trim()).filter(Boolean));
  readonly previewGuide=computed(()=>({
    id:'preview',
    category:this.category(),
    categoryLabel:this.categoryLabel(),
    title:this.title().trim() || 'Tiêu đề cẩm nang sơ cứu',
    heroTitle:this.heroTitle().trim() || this.title().trim() || 'Tiêu đề cẩm nang sơ cứu',
    description:this.summary().trim() || 'Mô tả tình huống và cách nhận biết dấu hiệu.',
    image:this.coverUrl().trim() || blogImages.postPlaceholder,
    urgent:this.urgency()==='URGENT',
    variant:this.urgency()==='URGENT' ? 'urgent' : 'image',
    steps:this.completedSteps(),
    emergencyPhone:this.hotline().trim(),
    videoUrl:this.videoUrl().trim(),
    videoTitle:this.videoTitle().trim(),
    videoDescription:this.videoDescription().trim(),
    videoHighlights:this.videoPoints(),
  }));

  constructor(){void this.loadInitial();}

  private async loadInitial():Promise<void>{
    if(!this.isEditing) return;
    try {
      const rows=await firstValueFrom(this.api.listFirstAid());
      const row=rows.find((item:any)=>backendId(item)===this.editId);
      if(row) this.hydrate(row);
      else {
        const detail=await firstValueFrom(this.api.getPost(this.editId));
        if(!detail) throw new Error('missing');
        this.hydrate(detail);
      }
    } catch {
      this.loadError.set('Không thể tải cẩm nang để chỉnh sửa. Vui lòng quay lại danh sách và thử lại.');
    } finally {this.loading.set(false);}
  }
  private hydrate(row:any):void {
    const rawCategory=row.category;
    const catText=String(typeof rawCategory==='string' ? rawCategory :
      rawCategory?.category_name || rawCategory?.name || rawCategory?.label ||
      rawCategory?.id || rawCategory?.first_aid_category_id || '');
    const normalized=catText.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const matched=this.categories.find(c=>c.id===catText ||
      c.label===catText || c.label.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()===normalized);
    this.category.set(matched?.id || '');
    this.title.set(String(row.title || ''));
    this.summary.set(String(row.situation_description || row.situationDescription || row.excerpt || ''));
    this.heroTitle.set(String(row.heroTitle || row.hero_title || ''));
    this.coverUrl.set(String(row.thumbnail_url || row.thumbnailUrl || row.cover_image_url || row.image_url || ''));
    const rawUrgency=String(row.urgencyLevel || row.urgency_level || row.severity || '').toUpperCase();
    this.urgency.set(row.urgent === true || rawUrgency==='URGENT' || rawUrgency==='HIGH' ? 'URGENT' : 'NORMAL');
    this.hotline.set(String(row.emergency_phone || row.emergencyPhone || ''));
    const rawSteps=Array.isArray(row.steps)?row.steps:[];
    const parsedSteps:AidStep[]=rawSteps.map((step:any,index:number)=>({
      id:index+1,title:String(step.title || ''),
      description:String(step.step_content || step.instruction || step.description || ''),
    }));
    // Preserve the structured steps returned by BE. Never manufacture a first-aid
    // instruction from an unrelated free-text content field.
    this.steps.set(parsedSteps);

    this.nextStepId=Math.max(0,...this.steps().map(s=>s.id))+1;
    this.videoUrl.set(String(row.video_url || row.videoUrl || row.video?.url || ''));
    this.videoTitle.set(String(row.video_title || row.videoTitle || row.video?.title || ''));
    this.videoDescription.set(String(row.video_description || row.videoDescription || row.video?.description || ''));
    const highlights=row.video_highlights || row.videoHighlights || row.video?.highlights || [];
    this.videoHighlights.set(Array.isArray(highlights)?highlights.join('\n'):String(highlights||''));
    const status=String(row.status || 'DRAFT').toUpperCase();
    this.savedStatus.set(status==='PUBLISHED'||status==='ARCHIVED'?status:'DRAFT');
    this.dirty.set(false);
  }
  setField(field:'title'|'category'|'summary'|'heroTitle'|'coverUrl'|'hotline'|'videoUrl'|'videoTitle'|'videoDescription'|'videoHighlights',value:string):void {
    this[field].set(value);this.dirty.set(true);this.error.set('');
  }
  setUrgency(value:AidUrgency):void {this.urgency.set(value);this.dirty.set(true);}
  addStep():void {
    this.steps.update(steps=>[...steps,{id:this.nextStepId++,title:'',description:''}]);
    this.dirty.set(true);
  }
  editStep(id:number,key:'title'|'description',value:string):void {
    this.steps.update(steps=>steps.map(s=>s.id===id?{...s,[key]:value}:s));
    this.dirty.set(true);
  }
  removeStep(id:number):void{
    this.steps.update(steps=>steps.filter(s=>s.id!==id));
    this.dirty.set(true);
  }
  moveStep(id:number,direction:-1|1):void {
    this.steps.update(steps=>{
      const index=steps.findIndex(s=>s.id===id),to=index+direction;
      if(index<0||to<0||to>=steps.length)return steps;
      const copy=[...steps];[copy[index],copy[to]]=[copy[to],copy[index]];
      return copy;
    });
    this.dirty.set(true);
  }
  private payload():Record<string,unknown>|null {
    if(!this.title().trim()||!this.categories.some(c=>c.id===this.category())||!this.summary().trim()){
      this.error.set('Nhập tiêu đề, chọn nhóm tình huống và mô tả tình huống trước khi lưu.');return null;
    }
    const steps=this.steps();
    if(!steps.length || steps.some(s=>!s.title.trim()||!s.description.trim())){
      this.error.set('Cẩm nang cần ít nhất một bước sơ cứu; mỗi bước phải có tên và hướng dẫn đầy đủ.');return null;
    }
    if(this.coverUrl().trim()&&!safeHttpUrl(this.coverUrl().trim())){
      this.error.set('URL ảnh bìa không hợp lệ. Chỉ chấp nhận http:// hoặc https://.');return null;
    }
    if(this.videoUrl().trim()&&!safeHttpUrl(this.videoUrl().trim())){
      this.error.set('URL video không hợp lệ. Chỉ chấp nhận http:// hoặc https://.');return null;
    }
    if(this.videoUrl().trim()&&!this.videoTitle().trim()){
      this.error.set('Nhập tiêu đề video nếu có gắn video hướng dẫn.');return null;
    }
    const normalizedSteps=steps.map((step,index)=>({
      step_number:index+1,title:step.title.trim(),step_content:step.description.trim(),
    }));
    return {
      postType:'FIRST_AID',status:this.savedStatus(),
      title:this.title().trim(),category:this.categoryLabel(),
      categoryId:this.category(),excerpt:this.summary().trim(),
      situation_description:this.summary().trim(),
      heroTitle:this.heroTitle().trim() || this.title().trim(),
      thumbnail_url:this.coverUrl().trim() || null,
      urgencyLevel:this.urgency(),urgent:this.urgency()==='URGENT',
      emergencyPhone:this.hotline().trim() || null,
      emergency_phone:this.hotline().trim() || null,
      steps:normalizedSteps,
      video_url:this.videoUrl().trim() || null,
      video_title:this.videoTitle().trim(),
      video_description:this.videoDescription().trim(),
      video_highlights:this.videoPoints(),
      content:normalizedSteps.map(s=>s.step_number+'. '+s.title+'\n'+s.step_content).join('\n\n'),
    };
  }
  async save(target:'DRAFT'|'PUBLISHED'):Promise<void>{
    if(!this.canWrite()||this.loading()||this.saving())return;
    const body=this.payload();if(!body)return;
    this.saving.set(true);this.error.set('');
    try {
      let id=this.savedId();
      if(id){await firstValueFrom(this.api.updatePost(id,body));}
      else {
        const created=await firstValueFrom(this.api.createPost({...body,status:'DRAFT'}));
        id=backendId(created);
        if(!id)throw new Error('API không trả mã cẩm nang; không thể xác nhận đã lưu.');
        this.savedId.set(id);
        const actual=String(created?.status||'').toUpperCase();
        if(actual && actual!=='DRAFT')throw new Error('API trả trạng thái không đúng với bản nháp.');
      }
      if(target!==this.savedStatus())await firstValueFrom(this.api.updatePostStatus(id,target));
      this.savedStatus.set(target);this.dirty.set(false);this.leaving=true;
      await this.router.navigate(['/admin/content/first-aid'],{
        queryParams:{notice:target==='PUBLISHED'?'Đã xuất bản cẩm nang.':'Đã lưu bản nháp cẩm nang.'},
      });
    } catch(err:any){
      this.error.set(err?.error?.message || err?.message ||
        'Không hoàn tất lưu/xuất bản. Nếu dữ liệu đã được tạo, hãy kiểm tra trạng thái trước khi thử lại.');
    } finally {this.saving.set(false);}
  }
  cancel():void{
    if(this.dirty() && typeof window!=='undefined' &&
      !window.confirm('Bạn có nội dung chưa lưu. Rời trang?')) return;
    this.leaving=true;void this.router.navigate(['/admin/content/first-aid']);
  }
  @HostListener('window:beforeunload',['$event'])
  beforeUnload(event:BeforeUnloadEvent):void {
    if(this.dirty()&&!this.leaving)event.preventDefault();
  }
}
