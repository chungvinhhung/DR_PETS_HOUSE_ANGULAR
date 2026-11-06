import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminBreadcrumbComponent } from '../../../../shared/admin-breadcrumb/admin-breadcrumb.component';
import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { CommunityCardComponent } from '../../../customer/blog/pages/community/community-card.component';
import { AdminContentService } from '../services/admin-content.service';

type CommunityType = 'Chia sẻ'|'Hỏi đáp'|'Thông báo';
type CommunityTarget = 'DRAFT'|'APPROVED';

function safeImageUrl(value:string):boolean {
  try { return ['https:', 'http:'].includes(new URL(value).protocol); }
  catch { return false; }
}

/**
 * Dedicated Admin composer for the community tab.
 * BE currently exposes moderation only; POST /admin/community/posts must be
 * implemented by BE before the create/draft flow can pass E2E.
 */
@Component({
  selector:'app-admin-community-create',
  standalone:true,
  imports:[CommonModule,FormsModule,AdminCatalogShellComponent,AdminBreadcrumbComponent,CommunityCardComponent],
  templateUrl:'./admin-community-create.component.html',
  styleUrl:'./admin-community-create.component.scss',
  changeDetection:ChangeDetectionStrategy.OnPush,
})
export class AdminCommunityCreateComponent {
  private readonly router=inject(Router);
  private readonly api=inject(AdminContentService);
  private readonly session=inject(AuthSessionService);
  readonly breadcrumb=[
    {label:'Bài đăng cộng đồng',link:'/admin/content/community'},
    {label:'Tạo bài đăng'},
  ];
  readonly types:CommunityType[]=['Chia sẻ','Hỏi đáp','Thông báo'];
  readonly isAdmin=computed(()=>this.session.user()?.systemRole==='ADMIN');
  readonly title=signal('');
  readonly content=signal('');
  readonly type=signal<CommunityType>('Chia sẻ');
  readonly imageDraft=signal('');
  readonly imageUrls=signal<string[]>([]);
  readonly error=signal('');
  readonly saving=signal(false);
  readonly dirty=signal(false);
  readonly preview=signal(true);
  private leaving=false;

  readonly previewPost=computed(()=>({
    id:'community-preview',
    title:this.title().trim(),
    content:this.content().trim() || 'Nội dung bài đăng sẽ hiển thị tại đây...',
    type:this.type(),
    image:this.imageUrls()[0] || '',
    images:this.imageUrls(),
    author:'Dr. Pet’s House',
    initials:'D',
    time:'Bản xem trước',
    likes:0,
    comments:0,
    tags:[],
  }));

  setTitle(value:string):void {this.title.set(value);this.dirty.set(true);this.error.set('');}
  setContent(value:string):void {this.content.set(value);this.dirty.set(true);this.error.set('');}
  setType(value:CommunityType):void {this.type.set(value);this.dirty.set(true);this.error.set('');}
  addImage():void {
    const url=this.imageDraft().trim();
    if(!url) return;
    if(!safeImageUrl(url)){this.error.set('Đường dẫn ảnh phải bắt đầu bằng https:// hoặc http://.');return;}
    if(this.imageUrls().length>=5){this.error.set('Tối đa 5 ảnh cho một bài đăng.');return;}
    if(!this.imageUrls().includes(url)){
      this.imageUrls.update(items=>[...items,url]);this.dirty.set(true);
    }
    this.imageDraft.set('');this.error.set('');
  }
  removeImage(url:string):void {
    this.imageUrls.update(items=>items.filter(value=>value!==url));
    this.dirty.set(true);this.error.set('');
  }
  handleImageKey(event:KeyboardEvent):void {
    if(event.key==='Enter'){event.preventDefault();this.addImage();}
  }
  async save(target:CommunityTarget):Promise<void>{
    if(!this.isAdmin()||this.saving())return;
    if(!this.title().trim()||!this.content().trim()){
      this.error.set('Vui lòng nhập tiêu đề và nội dung bài đăng trước khi lưu.');return;
    }
    if(this.imageDraft().trim()){
      this.addImage();
      if(this.imageDraft().trim())return;
    }
    const payload={
      title:this.title().trim(),
      content:this.content().trim(),
      type:this.type(),
      imageUrls:this.imageUrls(),
      status:target,
    };
    this.saving.set(true);this.error.set('');
    try {
      const created=await firstValueFrom(this.api.createCommunityPost(payload));
      const id=String(created?._id||created?.id||'');
      const actual=String(created?.status||'').toUpperCase();
      if(!id || actual!==target){
        throw new Error('BE chưa xác nhận mã bài đăng và trạng thái đã lưu. Hãy kiểm tra danh sách trước khi thử lại để tránh tạo trùng.');
      }
      this.dirty.set(false);this.leaving=true;
      await this.router.navigate(['/admin/content/community'],{
        queryParams:{notice:target==='DRAFT'?'Đã lưu bản nháp bài đăng.':'Đã đăng bài cộng đồng.'},
      });
    } catch(err:any) {
      const code=Number(err?.status||err?.error?.status||0);
      const hint=code===404||code===405
        ? 'Backend chưa hỗ trợ tạo bài đăng từ Admin (POST /admin/community/posts). Cần BE bổ sung trước khi tính năng hoạt động.'
        : (err?.error?.message||err?.message||'Không thể lưu bài đăng. Vui lòng kiểm tra API và thử lại.');
      this.error.set(hint);
    } finally {this.saving.set(false);}
  }
  cancel():void {
    if(this.dirty() && typeof window!=='undefined' && !window.confirm('Bạn có nội dung chưa lưu. Rời trang?')) return;
    this.leaving=true;void this.router.navigate(['/admin/content/community']);
  }
  @HostListener('window:beforeunload',['$event'])
  beforeUnload(event:BeforeUnloadEvent):void {
    if(this.dirty()&&!this.leaving)event.preventDefault();
  }
}
