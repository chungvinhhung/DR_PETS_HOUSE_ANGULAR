import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminBreadcrumbComponent } from '../../../../shared/admin-breadcrumb/admin-breadcrumb.component';
import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { AdminContentService } from '../services/admin-content.service';

export type ArticleBlockType = 'paragraph' | 'heading' | 'list' | 'quote' | 'image' | 'video';
export type ArticleLayout = 'STANDARD' | 'FEATURED';
export interface ArticleBlock { id: number; type: ArticleBlockType; text: string; alt?: string; }

function storedId(row: any): string {
  return String(row?._id || row?.id || row?.post_id || '');
}
function isWebUrl(value: string): boolean {
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol); }
  catch { return false; }
}
function normalizedBlocks(raw: unknown, fallback: string): ArticleBlock[] {
  if (Array.isArray(raw) && raw.length) {
    const supported: ArticleBlockType[] = ['paragraph','heading','list','quote','image','video'];
    const parsed = raw.filter((v: any) => supported.includes(v?.type) && typeof v?.text === 'string')
      .map((v: any, i: number) => ({ id: i + 1, type: v.type as ArticleBlockType, text: v.text, alt: String(v.alt || '') }));
    if (parsed.length) return parsed;
  }
  const paragraphs = fallback.split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
  return paragraphs.length
    ? paragraphs.map((text, i) => ({id:i+1,type:'paragraph',text}))
    : [{id:1,type:'paragraph',text:''}];
}

@Component({
  selector: 'app-admin-article-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminCatalogShellComponent, AdminBreadcrumbComponent],
  templateUrl: './admin-article-editor.component.html',
  styleUrl: './admin-article-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminArticleEditorComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly api = inject(AdminContentService);
  private readonly session = inject(AuthSessionService);
  readonly editId = this.route.snapshot.paramMap.get('id') || '';
  readonly isEditing = Boolean(this.editId);
  readonly canWrite = computed(() => this.session.user()?.systemRole === 'ADMIN');
  readonly title = signal('');
  readonly category = signal('');
  readonly excerpt = signal('');
  readonly coverUrl = signal('');
  readonly tags = signal('');
  readonly layout = signal<ArticleLayout>('STANDARD');
  readonly blocks = signal<ArticleBlock[]>([{id:1,type:'paragraph',text:''}]);
  readonly previewMode = signal<'CARD'|'DETAIL'>('DETAIL');
  readonly suggestedCategories = signal<string[]>([]);
  readonly savedStatus = signal<'DRAFT'|'PUBLISHED'|'ARCHIVED'>('DRAFT');
  readonly loading = signal(this.isEditing);
  readonly loadError = signal('');
  readonly saving = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly dirty = signal(false);
  readonly savedId = signal(this.editId);
  private nextBlockId = 2;
  private navigatingAway = false;

  readonly breadcrumb = [
    {label:'Bài viết kiến thức',link:'/admin/content/articles'},
    {label:this.isEditing ? 'Chỉnh sửa bài viết' : 'Tạo bài viết'}
  ];
  readonly summary = computed(() => this.excerpt().trim() ||
    this.blocks().find(x => x.type === 'paragraph' && x.text.trim())?.text.trim() || '');
  readonly categoryTags = computed(() => this.tags().split(/[;,\n]+/).map(x => x.trim().replace(/^#/, '')).filter(Boolean));
  readonly previewBlocks = computed(() => this.blocks().filter(block => block.text.trim()));
  readonly layoutNames: Record<ArticleLayout,string> = {STANDARD:'Bài viết thường',FEATURED:'Bài viết nổi bật'};
  readonly typeNames: Record<ArticleBlockType,string> = {
    paragraph:'Đoạn văn',heading:'Tiêu đề phụ',list:'Danh sách',quote:'Trích dẫn',image:'Hình ảnh',video:'Video'
  };

  constructor() { void this.initialize(); }

  private async initialize(): Promise<void> {
    // Categories are suggestions from real data; do not invent backend category IDs.
    try {
      const rows = await firstValueFrom(this.api.listArticles());
      this.suggestedCategories.set([...new Set(rows.map((r:any) =>
        String(typeof r.category === 'string' ? r.category : r.category?.name || r.category?.label || r.category?.category_name || '').trim())
        .filter(Boolean))].sort((a,b)=>a.localeCompare(b,'vi')));
      if (this.isEditing) {
        const found = rows.find((r:any) => storedId(r) === this.editId);
        if (found) this.hydrate(found);
        else await this.loadArticleDetail();
      }
    } catch {
      if (this.isEditing) await this.loadArticleDetail();
    } finally { this.loading.set(false); }
  }
  private async loadArticleDetail(): Promise<void> {
    try {
      const row = await firstValueFrom(this.api.getPost(this.editId));
      if (!row) throw new Error('Không có dữ liệu');
      this.hydrate(row);
    } catch {
      this.loadError.set('Không thể tải bài viết để chỉnh sửa. Vui lòng quay lại danh sách và thử lại.');
    }
  }
  private hydrate(row:any): void {
    const category = row.category;
    this.title.set(String(row.title || ''));
    this.category.set(String(typeof category === 'string' ? category : category?.name || category?.label || category?.category_name || ''));
    this.excerpt.set(String(row.excerpt || ''));
    this.coverUrl.set(String(row.thumbnail_url || row.thumbnailUrl || row.coverImage || ''));
    this.tags.set(Array.isArray(row.hashtags) ? row.hashtags.join(', ') : String(row.hashtags || ''));
    const layout = row.layoutType || row.layout_type;
    this.layout.set(layout === 'FEATURED' ? 'FEATURED' : 'STANDARD');
    const blocks = normalizedBlocks(row.contentBlocks || row.content_blocks, String(row.content || ''));
    this.blocks.set(blocks);
    this.nextBlockId = Math.max(...blocks.map(b => b.id),0)+1;
    const status = String(row.status || 'DRAFT').toUpperCase();
    this.savedStatus.set(status === 'PUBLISHED' || status === 'ARCHIVED' ? status : 'DRAFT');
    this.dirty.set(false);
  }
  setField(field:'title'|'category'|'excerpt'|'coverUrl'|'tags', value:string):void {
    this[field].set(value); this.dirty.set(true); this.error.set('');
  }
  setLayout(layout:ArticleLayout):void {
    this.layout.set(layout);this.dirty.set(true);
  }
  addBlock(type:ArticleBlockType):void {
    this.blocks.update(items => [...items,{id:this.nextBlockId++,type,text:'',alt:''}]);
    this.dirty.set(true);
  }
  updateBlock(id:number, field:'text'|'alt', value:string):void {
    this.blocks.update(items => items.map(block => block.id === id ? {...block,[field]:value} : block));
    this.dirty.set(true);
  }
  moveBlock(id:number,direction:-1|1):void {
    this.blocks.update(items => {
      const index = items.findIndex(x => x.id === id);
      const next = index + direction;
      if (index < 0 || next < 0 || next >= items.length) return items;
      const copy = [...items]; [copy[index],copy[next]] = [copy[next],copy[index]];
      return copy;
    });
    this.dirty.set(true);
  }
  removeBlock(id:number):void {
    this.blocks.update(items => items.filter(x => x.id !== id));
    this.dirty.set(true);
  }
  private payload(): Record<string,unknown> | null {
    const title = this.title().trim(), category = this.category().trim();
    const blocks = this.blocks().filter(b => b.text.trim());
    if (!title || !category || !blocks.length) {
      this.error.set('Nhập tiêu đề, chủ đề và ít nhất một khối nội dung trước khi lưu.');
      return null;
    }
    if (this.coverUrl().trim() && !isWebUrl(this.coverUrl().trim())) {
      this.error.set('Đường dẫn ảnh bìa phải là URL HTTPS hoặc HTTP hợp lệ.');return null;
    }
    for(const b of blocks) if (['image','video'].includes(b.type) && !isWebUrl(b.text.trim())) {
      this.error.set('Đường dẫn hình ảnh hoặc video trong nội dung chưa hợp lệ.');return null;
    }
    const content = blocks.map(b => {
      if(b.type === 'image' || b.type === 'video') return '';
      if(b.type === 'list') return b.text.split('\n').map(line => line.trim()).filter(Boolean).map(line => '• '+line).join('\n');
      return b.text.trim();
    }).filter(Boolean).join('\n\n');
    if (!content.trim()) {this.error.set('Bài viết cần có ít nhất một khối văn bản.');return null;}
    return {
      title,category,excerpt:this.excerpt().trim(),content,postType:'OFFICIAL_BLOG',
      status:'DRAFT',thumbnail_url:this.coverUrl().trim() || null,
      hashtags:this.categoryTags().join(', '),layoutType:this.layout(),
      contentBlocks:blocks.map(({type,text,alt}) => ({type,text:text.trim(),alt:alt?.trim() || ''})),
    };
  }
  async save(target:'DRAFT'|'PUBLISHED'):Promise<void> {
    if(this.saving() || !this.canWrite()) return;
    const body = this.payload();if(!body) return;
    this.saving.set(true);this.error.set('');this.notice.set('');
    try {
      let id = this.savedId();
      if (id) {
        await firstValueFrom(this.api.updatePost(id, body));
      } else {
        // Keep the created ID after a partial publish failure so retry cannot create a duplicate.
        const created = await firstValueFrom(this.api.createPost(body));
        id = storedId(created);
        if(!id) throw new Error('API không trả về mã bài viết; chưa thể xác minh trạng thái lưu.');
        this.savedId.set(id);
      }
      // Status updates use the explicit endpoint. Do not report publication
      // success until this request confirms the requested state.
      if(target !== this.savedStatus()) {
        await firstValueFrom(this.api.updatePostStatus(id,target));
      }
      this.savedStatus.set(target);
      this.dirty.set(false);
      this.navigatingAway = true;
      await this.router.navigate(['/admin/content/articles'],{
        queryParams:{notice: target === 'DRAFT' ? 'Đã lưu bản nháp bài viết.' : 'Đã xuất bản bài viết.'}
      });
    } catch(err:any) {
      this.error.set(err?.error?.message || err?.message ||
        (this.savedId() ? 'Không hoàn tất cập nhật/xuất bản. Dữ liệu có thể đã được lưu một phần; vui lòng kiểm tra trạng thái trước khi thử lại.' :
          'Không thể lưu bài viết. Vui lòng thử lại.'));
    } finally {this.saving.set(false);}
  }
  cancel():void {
    if(this.dirty() && typeof window !== 'undefined' &&
      !window.confirm('Bạn có nội dung chưa lưu. Rời khỏi trang?')) return;
    this.navigatingAway = true;
    void this.router.navigate(['/admin/content/articles']);
  }
  @HostListener('window:beforeunload', ['$event'])
  beforeUnload(event:BeforeUnloadEvent):void {
    if(!this.navigatingAway && this.dirty()) event.preventDefault();
  }
}
