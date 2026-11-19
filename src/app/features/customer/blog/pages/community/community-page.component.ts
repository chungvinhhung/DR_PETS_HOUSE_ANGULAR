import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, inject, signal, viewChild } from '@angular/core';
import { ActivatedRoute } from '@angular/router';

import { CustomerAuthService } from '../../../../../core/customer/services/customer-auth.service';
import { ContentApiService } from '../../../../../core/customer/services/api/content-api.service';
import { CanvasLayoutComponent } from '../../../../../shared/customer/components/canvas-layout/canvas-layout.component';
import { NavBarComponent } from '../../../../../layouts/customer/components/navbar/nav-bar.component';
import { ComposerComponent } from './composer.component';
import { CommunityCardComponent } from './community-card.component';
import { FooterComponent } from '../../../../../layouts/customer/components/footer/footer.component';
import { PostModalComponent } from './post-modal.component';
import { CustomerLinkDirective } from '../../../../../shared/customer/directives/customer-link.directive';
import { blogImages } from '../../../../../shared/customer/assets/blog-images';
import { EMPTY_COMMENTS, splitBalanced } from './community-page.helpers';

/**
 * CommunityPage — chuyển từ React: src/pages/Blog/CommunityPage.jsx
 */
@Component({
  selector: 'div[app-community-page]',
  standalone: true,
  imports: [CanvasLayoutComponent, NavBarComponent, ComposerComponent, CommunityCardComponent, FooterComponent, PostModalComponent, CustomerLinkDirective],
  templateUrl: './community-page.component.html',
  host: {
    'class': 'min-h-screen bg-white',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommunityPageComponent {
  // --- Service dùng chung ---
  protected readonly authService = inject(CustomerAuthService);
  protected readonly contentApi = inject(ContentApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly route = inject(ActivatedRoute);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly blogImages: any = blogImages;
  protected readonly EMPTY_COMMENTS: any = EMPTY_COMMENTS;

  // --- Giá trị tính toán (computed) ---
  readonly allPosts = computed<any>(() => this.posts());
  readonly columns = computed<any>(() => splitBalanced(this.allPosts()));
  readonly selectedPost = computed<any>(() => this.allPosts().find((post: any) => post.id === this.selectedId()));

  // --- Trạng thái (signal = useState / useRef) ---
  readonly posts = signal<any[]>([]);
  readonly posting = signal(false);
  readonly composer = viewChild(ComposerComponent);
  readonly selectedId = signal<any>(null);
  readonly commentsByPost = signal<any>({});
  readonly postState = signal<any>({});
  readonly shareNotice = signal<any>("");
  readonly isLoading = signal<any>(false);
  readonly loadError = signal<any>("");
  readonly apiEmptyMessage = signal<any>("");
  readonly commentsLoading = signal<any>(false);

  constructor() {
    // useEffect(..., []) -> chạy 1 lần sau khi render
    afterNextRender(() => {
      const cleanup = (() => {
        let active = true;
        this.isLoading.set(true);
        this.loadError.set("");
        this.apiEmptyMessage.set("");

        this.contentApi.getCommunityPostsPage({ page: 1, limit: 100 })
          .then((payload: any) => {
            if (!active) return;
            const items = (payload.posts || payload.items || []).filter((post: any) =>
              !post.status || String(post.status).toUpperCase() === 'APPROVED'
            );
            this.posts.set(items);
            if (!items.length) {
              this.apiEmptyMessage.set("Chưa có bài đăng cộng đồng đã được duyệt.");
            }
            const requestedId = this.route.snapshot.queryParamMap.get('postId');
            if (requestedId) {
              if (items.some((post: any) => post.id === requestedId)) {
                void this.openPost(requestedId);
              } else {
                this.apiEmptyMessage.set('Không tìm thấy bài đăng đã duyệt.');
              }
            }
          })
          .catch((error: any) => {
            if (!active) return;
            this.posts.set([]);
            this.loadError.set(error?.message || "Không thể tải bài viết cộng đồng. Vui lòng thử lại.");
          })
          .finally(() => {
            if (active) this.isLoading.set(false);
          });

        return () => {
          active = false;
        };
      })();
      if (typeof cleanup === 'function') this.destroyRef.onDestroy(cleanup);
    });
  }

  protected getState(id: any) {
    return (this.postState() as any)[id] || { liked: false };
  }

  protected updatePostState(id: any, key: any) {
    return this.postState.update((state: any) => {
    const current = (state as any)[id] || { liked: false };
    return { ...state, [id]: { ...current, [key]: !(current as any)[key] } };
  });
  }

  protected requireAuth(actionName: any) {
    this.shareNotice.set(`Vui lòng đăng nhập để ${actionName}.`);
    window.setTimeout(() => this.shareNotice.set(""), 2200);
    this.authService.openAuth?.("login");
    return false;
  }

  protected async openPost(id: any) {
    this.selectedId.set(id);
    const selected = this.allPosts().find((post: any) => post.id === id);
    if (!selected?.backendId) return;

    this.commentsLoading.set(true);
    try {
      const payload = await this.contentApi.getPostComments(selected.backendId, { limit: 50 });
      const currentProfile = this.authService.userProfile();
      const currentUserId = currentProfile?.userId || currentProfile?.id || "";
      const currentUserName = (currentProfile?.fullName || currentProfile?.name || "").trim().toLowerCase();

      const flattenedComments = payload.comments.flatMap((comment: any) => {
        const commentAuthor = String(comment.author || "").trim().toLowerCase();
        const isSelf = comment.isOwn || (comment.userId && comment.userId === currentUserId) || commentAuthor === "bạn" || (Boolean(currentUserName) && commentAuthor === currentUserName);
        return [
          {
            id: comment.id,
            author: comment.author,
            avatar: comment.avatar,
            content: comment.content,
            time: comment.time,
            userId: comment.userId,
            isOwn: isSelf,
          },
          ...comment.replies.map((reply: any) => {
            const replyAuthor = String(reply.author || "").trim().toLowerCase();
            const replyIsSelf = reply.isOwn || (reply.userId && reply.userId === currentUserId) || replyAuthor === "bạn" || (Boolean(currentUserName) && replyAuthor === currentUserName);
            return {
              id: reply.id,
              author: reply.author,
              avatar: reply.avatar,
              content: reply.content,
              replyTo: reply.replyTo,
              time: reply.time,
              userId: reply.userId,
              isOwn: replyIsSelf,
            };
          }),
        ];
      });

      this.commentsByPost.update((state: any) => ({
        ...state,
        [id]: flattenedComments,
      }));
    } catch {
      // Fallback silently without throwing error toast
    } finally {
      this.commentsLoading.set(false);
    }
  }

  protected async sharePost(post: any) {
    const url = `${window.location.origin}/blog/cong-dong?postId=${encodeURIComponent(String(post.id))}`;
    if (navigator.share) await navigator.share({ title: post.title || "Bài viết cộng đồng", url }).catch(() => {});
    else await navigator.clipboard?.writeText(url);
    this.shareNotice.set("Đã sao chép liên kết bài viết");
    window.setTimeout(() => this.shareNotice.set(""), 1800);
  }

  protected async addPost(payload: any): Promise<void> {
    if (!this.authService.isAuthenticated()) {
      this.requireAuth("đăng bài");
      return;
    }
    if (this.posting()) return;
    const content = String(payload?.content || '').trim();
    if (!content) {
      this.shareNotice.set('Vui lòng nhập nội dung bài đăng.');
      return;
    }
    // A blob: URL is only local to this browser and cannot be published as a real upload.
    if (payload?.image || payload?.video) {
      this.shareNotice.set('Chưa thể tải ảnh/video lên máy chủ. Vui lòng bỏ tệp đính kèm rồi đăng bài.');
      return;
    }

    const title = (content.split(/\r?\n/).find(line => line.trim()) || content).slice(0, 120);
    this.posting.set(true);
    this.shareNotice.set('');
    try {
      const created = await this.contentApi.createCommunityPost({
        title, content, imageUrls: [], type: String(payload?.type || ''),
      });
      if (!created?.backendId || String(created?.status || '').toUpperCase() !== 'PENDING') {
        throw new Error('BE chưa xác nhận bài đăng ở trạng thái chờ duyệt. Vui lòng kiểm tra trước khi gửi lại.');
      }
      // Only APPROVED posts can enter the public feed.
      this.composer()?.reset();
      this.shareNotice.set('Đã gửi bài thành công. Bài viết sẽ xuất hiện sau khi được duyệt.');
      window.setTimeout(() => this.shareNotice.set(''), 5000);
    } catch (error: any) {
      this.shareNotice.set(error?.message || 'Không thể gửi bài. Nội dung vẫn được giữ lại để thử lại.');
    } finally {
      this.posting.set(false);
    }
  }

  protected async addComment(postId: any, content: any, replyTo: any, parentCommentId: any = null) {
    const selected = this.allPosts().find((post: any) => post.id === postId);
    if (!selected) return;

    if (!this.authService.isAuthenticated()) {
      this.requireAuth("bình luận");
      return;
    }

    if (!selected.backendId) {
      this.shareNotice.set("Bài viết mẫu chưa hỗ trợ bình luận.");
      window.setTimeout(() => this.shareNotice.set(""), 2200);
      return;
    }

    const userSnapshot = this.authService.userProfile();
    const authorInfo = {
      fullName: userSnapshot?.fullName || userSnapshot?.name || "Bạn",
      avatarUrl: userSnapshot?.avatarUrl || userSnapshot?.avatar || "",
      userId: userSnapshot?.userId || userSnapshot?.id || "",
    };

    try {
      const existingList = (this.commentsByPost() as any)[postId] || [];
      const parentComment = parentCommentId
        ? existingList.find((c: any) => c.id === parentCommentId)
        : (replyTo
          ? existingList.find((c: any) => c.author === replyTo || (replyTo === "Bạn" && c.isOwn))
          : null);

      if (replyTo && parentComment?.id) {
        await this.contentApi.replyPostComment(selected.backendId, parentComment.id, content, authorInfo, replyTo);
      } else {
        await this.contentApi.createPostComment(selected.backendId, content, authorInfo);
      }

      const payload = await this.contentApi.getPostComments(selected.backendId, { limit: 50 });
      const currentProfile = this.authService.userProfile();
      const currentUserId = currentProfile?.userId || currentProfile?.id || "";
      const currentUserName = (currentProfile?.fullName || currentProfile?.name || "").trim().toLowerCase();

      const flattenedComments = payload.comments.flatMap((comment: any) => {
        const commentAuthor = String(comment.author || "").trim().toLowerCase();
        const isSelf = comment.isOwn || (comment.userId && comment.userId === currentUserId) || commentAuthor === "bạn" || (Boolean(currentUserName) && commentAuthor === currentUserName);
        return [
          {
            id: comment.id,
            author: comment.author,
            avatar: comment.avatar,
            content: comment.content,
            time: comment.time,
            userId: comment.userId,
            isOwn: isSelf,
          },
          ...comment.replies.map((reply: any) => {
            const replyAuthor = String(reply.author || "").trim().toLowerCase();
            const replyIsSelf = reply.isOwn || (reply.userId && reply.userId === currentUserId) || replyAuthor === "bạn" || (Boolean(currentUserName) && replyAuthor === currentUserName);
            return {
              id: reply.id,
              author: reply.author,
              avatar: reply.avatar,
              content: reply.content,
              replyTo: reply.replyTo,
              time: reply.time,
              userId: reply.userId,
              isOwn: replyIsSelf,
            };
          }),
        ];
      });

      this.commentsByPost.update((state: any) => ({ ...state, [postId]: flattenedComments }));
      this.posts.update((items: any) =>
        items.map((post: any) =>
          post.id === postId ? { ...post, comments: flattenedComments.length } : post,
        ));
    } catch (error: any) {
      this.shareNotice.set(error?.message || "Không thể gửi bình luận.");
      window.setTimeout(() => this.shareNotice.set(""), 2200);
    }
  }

  protected async handleLikePost(post: any) {
    if (!this.authService.isAuthenticated()) {
      this.requireAuth("like");
      return;
    }

    if (!post.backendId) {
      this.shareNotice.set("Bài viết mẫu chưa hỗ trợ like.");
      window.setTimeout(() => this.shareNotice.set(""), 2200);
      return;
    }

    const currentlyLiked = this.getState(post.id).liked;

    this.postState.update((state: any) => ({
      ...state,
      [post.id]: {
        ...((state as any)[post.id] || { liked: false }),
        liked: !currentlyLiked,
      },
    }));
    this.posts.update((items: any) =>
      items.map((item: any) =>
        item.id === post.id
          ? { ...item, likes: Math.max(0, Number(item.likes || 0) + (currentlyLiked ? -1 : 1)) }
          : item,
      ));

    try {
      await this.contentApi.togglePostLike(post.backendId);
    } catch (error: any) {
      // Restore the original count and like state if BE rejects the change.
      this.postState.update((state: any) => ({
        ...state, [post.id]: { ...((state as any)[post.id] || {}), liked: currentlyLiked },
      }));
      this.posts.update((items: any) =>
        items.map((item: any) => item.id === post.id
          ? { ...item, likes: Math.max(0, Number(item.likes || 0) + (currentlyLiked ? 1 : -1)) }
          : item)
      );
      this.shareNotice.set(error?.message || 'Không thể thích bài viết lúc này.');
    }
  }
}
