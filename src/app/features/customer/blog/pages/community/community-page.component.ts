import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';

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
import { COMMUNITY_POSTS, FEATURED_COMMUNITY_POST, INITIAL_COMMUNITY_COMMENTS } from '../../../../../shared/customer/data/community-data';
import { EMPTY_COMMENTS, normalizeCommunityPost, normalizeApiCommunityPost, splitBalanced } from './community-page.helpers';

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

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly blogImages: any = blogImages;
  protected readonly EMPTY_COMMENTS: any = EMPTY_COMMENTS;

  // --- Giá trị tính toán (computed) ---
  readonly featured = computed<any>(() => ({ ...normalizeCommunityPost(FEATURED_COMMUNITY_POST), featured: true }));
  readonly allPosts = computed<any>(() => [this.featured(), ...this.posts()]);
  readonly columns = computed<any>(() => splitBalanced(this.allPosts()));
  readonly selectedPost = computed<any>(() => this.allPosts().find((post: any) => post.id === this.selectedId()));

  // --- Trạng thái (signal = useState / useRef) ---
  readonly posts = signal<any>((() => COMMUNITY_POSTS.map(normalizeCommunityPost))());
  readonly selectedId = signal<any>(null);
  readonly commentsByPost = signal<any>({ [this.featured().id]: INITIAL_COMMUNITY_COMMENTS });
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

        this.contentApi.getCommunityPosts({ limit: 100 })
          .then((payload: any) => {
            if (!active) return;
            if (!payload.items || !payload.items.length) {
              this.apiEmptyMessage.set("API cộng đồng chưa có dữ liệu, đang hiển thị dữ liệu mẫu từ giao diện.");
              return;
            }
            this.posts.set(payload.items);
          })
          .catch((error: any) => {
            if (!active) return;
            this.apiEmptyMessage.set(error?.message || "Không thể tải bài viết cộng đồng, đang hiển thị dữ liệu mẫu từ giao diện.");
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
      const flattenedComments = payload.comments.flatMap((comment: any) => [
        {
          id: comment.id,
          author: comment.author,
          avatar: comment.avatar,
          content: comment.content,
          time: comment.time,
        },
        ...comment.replies.map((reply: any) => ({
          id: reply.id,
          author: reply.author,
          avatar: reply.avatar,
          content: reply.content,
          replyTo: reply.replyTo,
          time: reply.time,
        })),
      ]);

      this.commentsByPost.update((state: any) => ({
        ...state,
        [id]: flattenedComments,
      }));
    } catch (error: any) {
      this.shareNotice.set(error?.message || "Không thể tải bình luận bài viết.");
      window.setTimeout(() => this.shareNotice.set(""), 2200);
    } finally {
      this.commentsLoading.set(false);
    }
  }

  protected async sharePost(post: any) {
    const url = `${window.location.origin}/blog/cong-dong#${post.id}`;
    if (navigator.share) await navigator.share({ title: post.title || "Bài viết cộng đồng", url }).catch(() => {});
    else await navigator.clipboard?.writeText(url);
    this.shareNotice.set("Đã sao chép liên kết bài viết");
    window.setTimeout(() => this.shareNotice.set(""), 1800);
  }

  protected async addPost(payload: any) {
    if (!this.authService.isAuthenticated()) {
      this.requireAuth("đăng bài");
      return;
    }
    const content = payload.content || "";
    const title = payload.title || (content.length > 60 ? content.slice(0, 60) + "..." : content) || "Bài viết chia sẻ";
    const imageUrls = payload.image ? [payload.image] : (payload.images || []);

    const userSnapshot = this.authService.userProfile();
    const authorName = userSnapshot?.fullName || userSnapshot?.name || "Bạn";
    const tempId = `post-${Date.now()}`;
    const optimisticPost = {
      id: tempId,
      backendId: "",
      author: authorName,
      initials: authorName.slice(0, 1).toUpperCase(),
      time: "Vừa xong",
      likes: 0,
      comments: 0,
      ...payload,
    };
    this.posts.update((items: any) => [optimisticPost, ...items]);

    try {
      const created = await this.contentApi.createCommunityPost({
        title,
        content,
        imageUrls,
      });
      this.shareNotice.set("Đăng bài chia sẻ thành công! Cảm ơn bạn đã đóng góp cho cộng đồng.");
      window.setTimeout(() => this.shareNotice.set(""), 3000);
      if (created?.id) {
        this.posts.update((items: any) =>
          items.map((item: any) => (item.id === tempId ? { ...item, ...created } : item))
        );
      }
    } catch (error: any) {
      this.shareNotice.set(error?.message || "Đã đăng bài viết.");
      window.setTimeout(() => this.shareNotice.set(""), 3000);
    }
  }

  protected async addComment(postId: any, content: any, replyTo: any) {
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

    try {
      const parentComment = replyTo
        ? ((this.commentsByPost() as any)[postId] || []).find((comment: any) => comment.author === replyTo)
        : null;

      if (replyTo && parentComment?.id) {
        await this.contentApi.replyPostComment(parentComment.id, content);
      } else {
        await this.contentApi.createPostComment(selected.backendId, content);
      }

      const payload = await this.contentApi.getPostComments(selected.backendId, { limit: 50 });
      const flattenedComments = payload.comments.flatMap((comment: any) => [
        {
          id: comment.id,
          author: comment.author,
          avatar: comment.avatar,
          content: comment.content,
          time: comment.time,
        },
        ...comment.replies.map((reply: any) => ({
          id: reply.id,
          author: reply.author,
          avatar: reply.avatar,
          content: reply.content,
          replyTo: reply.replyTo,
          time: reply.time,
        })),
      ]);

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

    try {
      await this.contentApi.togglePostLike(post.backendId);
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
    } catch (error: any) {
      this.shareNotice.set(error?.message || "Không thể thích bài viết lúc này.");
      window.setTimeout(() => this.shareNotice.set(""), 2200);
    }
  }
}
