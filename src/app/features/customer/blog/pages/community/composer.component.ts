import { ChangeDetectionStrategy, Component, ElementRef, input, output, signal, viewChild } from '@angular/core';

import { CustomerIconComponent } from '../../../../../shared/customer/components/icon/customer-icon.component';
import { blogImages } from '../../../../../shared/customer/assets/blog-images';
import { POST_TYPES } from './community-page.helpers';

/**
 * Composer — chuyển từ React: src/pages/Blog/CommunityPage.jsx
 */
@Component({
  selector: 'section[app-composer]',
  standalone: true,
  imports: [CustomerIconComponent],
  templateUrl: './composer.component.html',
  host: {
    'class': 'relative w-[1210px] overflow-visible rounded-[32px] border-2 border-dashed border-[rgba(0,90,180,0.2)] bg-[#FFF9C4] p-8 shadow-[0_20px_25px_-5px_rgba(0,0,0,0.1)]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ComposerComponent {
  // --- Input / Output (props của React) ---
  readonly onPost = output<any>();
  readonly canPost = input<any>(undefined);
  readonly submitting = input<boolean>(false);
  readonly onRequireAuth = output<any>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly blogImages: any = blogImages;
  protected readonly POST_TYPES: any = POST_TYPES;

  // --- Trạng thái (signal = useState / useRef) ---
  readonly value = signal<any>("");
  readonly type = signal<any>("");
  readonly media = signal<any>(null);
  readonly showTypes = signal<any>(false);
  readonly imageInput = viewChild<ElementRef<any>>('imageInput');
  readonly videoInput = viewChild<ElementRef<any>>('videoInput');

  protected requirePostAuth() {
    if (this.canPost()) return true;
    this.onRequireAuth.emit("đăng bài");
    return false;
  }

  protected selectFile(event: any, kind: any) {
    if (!this.requirePostAuth()) {
      event.target.value = "";
      return;
    }
    const file = event.target.files?.[0];
    if (!file) return;
    this.clearMedia();
    this.media.set({ kind, name: file.name, url: URL.createObjectURL(file) });
  }

  protected submit() {
    if (!this.requirePostAuth() || this.submitting()) return;
    if (!this.value().trim() && !this.media()) return;
    // The parent confirms an API response before clearing the draft.
    this.onPost.emit({ content: this.value().trim(), type: this.type(), [this.media()?.kind]: this.media()?.url });
  }

  clearMedia():void {
    const previous=this.media();
    if(previous?.url && typeof URL!=='undefined')URL.revokeObjectURL(previous.url);
    this.media.set(null);
    if(this.imageInput()?.nativeElement)this.imageInput()!.nativeElement.value='';
    if(this.videoInput()?.nativeElement)this.videoInput()!.nativeElement.value='';
  }

  reset():void {
    this.value.set("");
    this.clearMedia();
    this.type.set("");
    this.showTypes.set(false);
  }

  protected handle1(event: any) {
    if (this.canPost()) this.value.set(event.target.value);
  }

  protected handle2() {
    this.requirePostAuth() && this.showTypes.update((open: any) => !open);
  }

  /** (tự sinh) global Object không dùng trực tiếp được trong template */
  protected list3(): any {
    return Object.keys(POST_TYPES);
  }

  protected handle4(item: any) { this.type.set(item); this.showTypes.set(false); }
}
