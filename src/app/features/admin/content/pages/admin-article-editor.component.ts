import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminBreadcrumbComponent } from '../../../../shared/admin-breadcrumb/admin-breadcrumb.component';
import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { AdminContentService } from '../services/admin-content.service';
import { BlogCardComponent } from '../../../../shared/customer/components/blog-card/blog-card.component';
import { FeaturedPostComponent } from '../../../customer/blog/pages/blog/featured-post.component';
import { blogImages } from '../../../../shared/customer/assets/blog-images';
import { BLOG_CATEGORIES } from '../../../../shared/customer/data/blog-data';
import { AdminArticleRichBlockComponent } from './admin-article-rich-block.component';

export type ArticleBlockType = 'paragraph' | 'heading' | 'list' | 'quote' | 'image' | 'video';
export type ArticleLayout = 'STANDARD' | 'FEATURED';
export interface ArticleBlock { id: number; type: ArticleBlockType; text: string; alt?: string; html?: string; }

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
      .map((v: any, i: number) => ({
        id: i + 1, type: v.type as ArticleBlockType,
        text: v.type === 'list'
          ? v.text.split(/\r?\n/).map((line:string)=>line.replace(/^\s*(?:[•*\-]|\d+[.)])\s+/, '')).join('\n')
          : v.text,
        alt: String(v.alt || ''), html: typeof v.html === 'string' ? v.html : '',
      }));
    if (parsed.length) return parsed;
  }
  const paragraphs = fallback.split(/\n\s*\n/).map(x => x.trim()).filter(Boolean);
  return paragraphs.length
    ? paragraphs.map((text, i): ArticleBlock => ({id:i+1,type:'paragraph',text}))
    : [{id:1,type:'paragraph' as const,text:''}];
}

@Component({
  selector: 'app-admin-article-editor',
  standalone: true,
  imports: [CommonModule, FormsModule, AdminCatalogShellComponent, AdminBreadcrumbComponent, BlogCardComponent, FeaturedPostComponent, AdminArticleRichBlockComponent],
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
  readonly tags = signal<string[]>([]);
  readonly tagDraft = signal('');
  readonly categories = BLOG_CATEGORIES.filter(c=>c.id !== 'all');
  readonly contentTagHelp = 'Hiển thị ở cuối bài viết dưới dạng #ThẻNộiDung trên web Customer.';
  readonly layout = signal<ArticleLayout>('STANDARD');
  readonly blocks = signal<ArticleBlock[]>([{id:1,type:'paragraph',text:''}]);
  readonly previewMode = signal<'CARD'|'DETAIL'>('CARD');
  readonly previewDevice = signal<'DESKTOP'|'MOBILE'>('DESKTOP');
  readonly savedStatus = signal<'DRAFT'|'PUBLISHED'|'ARCHIVED'>('DRAFT');
  readonly articlePublishedDate = signal<string>('');
  readonly previewCategoryId = computed(() => {
    const value = this.category().trim().normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
    const matched = BLOG_CATEGORIES.find(item =>
      item.label.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase() === value ||
      item.id === value);
    if (matched) return matched.id;
    if (value === 'cham soc') return 'care';
    return 'other';
  });
  // Render the actual Customer BlogCard/FeaturedPost components, not a second,
  // approximately styled interpretation of the card.
  readonly previewPost = computed(() => ({
    id: 'preview',
    category: this.previewCategoryId(),
    categoryLabel: this.category().trim() || 'Chủ đề',
    title: this.title().trim() || 'Tiêu đề bài viết',
    excerpt: this.summary() || 'Tóm tắt bài viết sẽ xuất hiện tại đây.',
    image: this.coverUrl().trim() || blogImages.postPlaceholder,
    author: "Dr. Pet's House",
    authorImage: blogImages.authorMinhAnh,
    publishedAt: this.articlePublishedDate() || 'Chưa xuất bản',
  }));
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
  readonly categoryTags = computed(() => this.tags());
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
    const categoryValue=String(typeof category==='string' ? category :
      category?.name || category?.label || category?.category_name || category?.id || '');
    const selected=this.categories.find(option => option.label === categoryValue || option.id === categoryValue);
    this.category.set(selected?.label || categoryValue);
    this.excerpt.set(String(row.excerpt || ''));
    this.coverUrl.set(String(row.thumbnail_url || row.thumbnailUrl || row.coverImage || ''));
    const rawTags: string = Array.isArray(row.hashtags)
      ? row.hashtags.map((tag: unknown) => String(tag)).join(',')
      : String(row.hashtags || '');
    const normalizedTags: string[] = [...new Set<string>(
      rawTags.split(/[,;\s]+/)
        .map((tag: string) => this.normalizeTag(tag))
        .filter((tag: string) => tag.length > 0),
    )].slice(0, 12);
    this.tags.set(normalizedTags);
    const layout = row.layoutType || row.layout_type;
    this.layout.set(layout === 'FEATURED' ? 'FEATURED' : 'STANDARD');
    const blocks = normalizedBlocks(row.contentBlocks || row.content_blocks, String(row.content || ''));
    this.blocks.set(blocks);
    this.nextBlockId = Math.max(...blocks.map(b => b.id),0)+1;
    const status = String(row.status || 'DRAFT').toUpperCase();
    this.savedStatus.set(status === 'PUBLISHED' || status === 'ARCHIVED' ? status : 'DRAFT');
    const rawDate = row.published_at || row.publishedAt || row.created_at || row.createdAt;
    const parsedDate = rawDate ? new Date(rawDate) : null;
    this.articlePublishedDate.set(parsedDate && !Number.isNaN(parsedDate.getTime()) ?
      parsedDate.toLocaleDateString('vi-VN',{day:'2-digit',month:'long',year:'numeric'}) : '');
    this.dirty.set(false);
  }
  private normalizeTag(value:string):string {
    return value.trim().replace(/^#+/,'').replace(/\s+/g,'').slice(0,40);
  }
  commitTag():void {
    const tag=this.normalizeTag(this.tagDraft());
    if(!tag) {this.tagDraft.set('');return;}
    if(this.tags().length>=12) {
      this.error.set('Tối đa 12 thẻ nội dung cho mỗi bài viết.');return;
    }
    if(!this.tags().some(x=>x.toLocaleLowerCase('vi')===tag.toLocaleLowerCase('vi'))) {
      this.tags.update(tags=>[...tags,tag]);this.dirty.set(true);
    }
    this.tagDraft.set('');
  }
  handleTagKey(event:KeyboardEvent):void {
    if(event.key==='Enter'||event.key===',') {
      event.preventDefault();this.commitTag();
    }
  }
  removeTag(tag:string):void {
    this.tags.update(tags=>tags.filter(x=>x!==tag));this.dirty.set(true);
  }
  updateRichBlock(id:number, value:{text:string;html:string}):void {
    this.blocks.update(items=>items.map(b=>b.id===id?{...b,text:value.text,html:value.html}:b));
    this.dirty.set(true);
  }
  setField(field:'title'|'category'|'excerpt'|'coverUrl', value:string):void {
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
    this.commitTag();
    const title = this.title().trim(), category = this.category().trim();
    const blocks = this.blocks().filter(b => b.text.trim());
    if (!title || !category || !this.categories.some(c=>c.label===category) || !blocks.length) {
      this.error.set('Nhập tiêu đề, chọn một trong bốn chủ đề cố định và thêm ít nhất một khối nội dung.');
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
      if(b.type === 'list') return b.text.split('\n').map(line => line.trim()).filter(Boolean).map((line,i) => `${i+1}. ${line}`).join('\n');
      return b.text.trim();
    }).filter(Boolean).join('\n\n');
    if (!content.trim()) {this.error.set('Bài viết cần có ít nhất một khối văn bản.');return null;}
    return {
      title,category,excerpt:this.excerpt().trim(),content,postType:'OFFICIAL_BLOG',
      status:this.savedStatus(),thumbnail_url:this.coverUrl().trim() || null,
      hashtags:this.categoryTags().join(', '),layoutType:this.layout(),
      contentBlocks:blocks.map(({type,text,alt,html}) => ({
        type,text:text.trim(),alt:alt?.trim() || '',html:html || '',
      })),
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
        const actualStatus = String(created?.status || '').toUpperCase();
        if (actualStatus && actualStatus !== 'DRAFT') {
          throw new Error('BE trả về trạng thái khác bản nháp khi tạo bài viết. Vui lòng kiểm tra trước khi tiếp tục.');
        }
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
