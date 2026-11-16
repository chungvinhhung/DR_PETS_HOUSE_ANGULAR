import { ChangeDetectionStrategy, Component, ElementRef, computed, inject, input, output, signal, viewChild } from '@angular/core';

import { CustomerAuthService } from '../../../../../core/customer/services/customer-auth.service';
import { AuthorComponent } from './author.component';
import { TypeBadgeComponent } from './type-badge.component';
import { ActionsComponent } from './actions.component';
import { CustomerIconComponent } from '../../../../../shared/customer/components/icon/customer-icon.component';
import { blogImages } from '../../../../../shared/customer/assets/blog-images';

/**
 * PostModal — chuyển từ React: src/pages/Blog/CommunityPage.jsx
 *
 * Ghi chú chuyển đổi:
 *  - output onAddComment được gọi với 2 tham số -> gộp thành mảng
 */
@Component({
  selector: 'div[app-post-modal]',
  standalone: true,
  imports: [AuthorComponent, TypeBadgeComponent, ActionsComponent, CustomerIconComponent],
  templateUrl: './post-modal.component.html',
  styleUrl: './post-modal.component.scss',
  host: {
    'class': 'fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4 sm:p-6',
    '(mousedown)': 'onClose.emit($event)',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PostModalComponent {
  // --- Service dùng chung ---
  protected readonly authService = inject(CustomerAuthService);

  // --- Input / Output (props của React) ---
  readonly post = input<any>(undefined);
  readonly comments = input<any>(undefined);
  readonly state = input<any>(undefined);
  readonly onClose = output<any>();
  readonly onAddComment = output<any>();
  readonly onLike = output<any>();
  readonly onShare = output<any>();
  readonly canInteract = input<any>(undefined);
  readonly onRequireAuth = output<any>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly blogImages: any = blogImages;

  // --- Giá trị tính toán (computed) ---
  readonly currentUserAvatar = computed(() => {
    const profile = this.authService.userProfile();
    return profile?.avatarUrl || profile?.avatar || "";
  });

  // --- Trạng thái (signal = useState / useRef) ---
  readonly value = signal<any>("");
  readonly replyTo = signal<any>(null);
  readonly replyingComment = signal<any>(null);
  readonly attachment = signal<any>(null);
  readonly likedComments = signal<any>({});
  readonly imageInput = viewChild<ElementRef<any>>('imageInput');
  readonly fileInput = viewChild<ElementRef<any>>('fileInput');
  readonly commentInput = viewChild<ElementRef<any>>('commentInput');

  protected selectAttachment(event: any, kind: any) {
    const file = event.target.files?.[0];
    if (file) this.attachment.set({ kind, name: file.name });
  }

  protected isMyComment(comment: any): boolean {
    if (!comment) return false;
    if (comment.isOwn) return true;
    const profile = this.authService.userProfile();
    const currentUserId = profile?.userId || profile?.id;
    if (currentUserId && comment.userId && comment.userId === currentUserId) return true;
    const currentName = (profile?.fullName || profile?.name || "").trim().toLowerCase();
    const commentAuthor = String(comment.author || "").trim().toLowerCase();
    return commentAuthor === "bạn" || (Boolean(currentName) && commentAuthor === currentName);
  }

  protected getCommentAuthorName(comment: any): string {
    return this.isMyComment(comment) ? "Bạn" : (comment.author || "Người dùng");
  }

  protected getCommentAvatar(comment: any): string {
    if (this.isMyComment(comment)) {
      return this.currentUserAvatar() || comment.avatar || "";
    }
    return comment.avatar || "";
  }

  protected submit() {
    if (!this.value().trim() && !this.attachment()) return;
    if (!this.canInteract()) {
      this.onRequireAuth.emit("bình luận");
      return;
    }
    const text = this.value().trim() || `Đã gửi ${this.attachment().kind === "image" ? "một ảnh" : "một tệp đính kèm"}`;
    const repComment = this.replyingComment();
    this.onAddComment.emit([text, this.replyTo(), repComment?.id || null]);
    this.value.set("");
    this.replyTo.set(null);
    this.replyingComment.set(null);
    this.attachment.set(null);
  }

  protected handle1(comment: any) {
    this.canInteract() ? this.likedComments.update((items: any) => ({ ...items, [comment.id]: !(items as any)[comment.id] })) : this.onRequireAuth.emit("like");
  }

  protected handle2(comment: any) {
    if (!this.canInteract()) {
      this.onRequireAuth.emit("bình luận");
      return;
    }
    this.replyingComment.set(comment);
    this.replyTo.set(this.getCommentAuthorName(comment));
    this.commentInput()?.nativeElement?.focus();
  }

  protected handle3() { if (!this.canInteract()) this.onRequireAuth.emit("bình luận"); }

  protected handle4(event: any) { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); this.submit(); } }
}
