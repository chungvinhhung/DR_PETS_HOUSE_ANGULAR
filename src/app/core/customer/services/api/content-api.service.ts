/**
 * Chuyển từ React: src/services/contentService.js
 *
 * - Các hàm "normalize..." / tiện ích không gọi API: giữ nguyên là hàm export (thuần, dùng được ở mọi nơi).
 * - Các hàm async gọi API: gom vào class ContentApiService (inject vào component).
 *   Gọi HTTP qua CustomerHttpService (bọc ApiClientService của core) -> trả về Promise như axios cũ.
 */
import { Injectable, inject } from '@angular/core';

import { CustomerHttpService, assertSuccess } from '../customer-http.service';
import { blogImages } from '../../../../shared/customer/assets/blog-images';

function formatDate(value: any) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("vi-VN", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function slugify(value: any = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

const blogCategoryAliases = {
  "suc-khoe": "health",
  "suc-khoe-thu-cung": "health",
  "dinh-duong": "nutrition",
  "tam-ly": "psychology",
  "hanh-vi": "psychology",
  "ve-sinh-lam-dep": "grooming",
  grooming: "grooming",
  "cham-soc": "care",
};

const firstAidCategoryAliases = {
  "tai-nan": "accident",
  "ngo-doc": "poisoning",
  "kho-tho": "breathing",
  "chan-thuong": "injury",
};

function normalizeBlogCategory(category: any = {}) {
  const label = category.category_name || category.label || "Chủ đề";
  const rawId = String(category.post_category_id || category.id || slugify(label));
  const mappedId = (blogCategoryAliases as any)[slugify(label)] || rawId;

  return {
    id: mappedId,
    backendId: String(category.post_category_id || category.id || ""),
    label,
  };
}

function normalizeFirstAidCategory(category: any = {}) {
  const label = category.category_name || category.label || "Chủ đề";
  const rawId = String(category.first_aid_category_id || category.id || slugify(label));
  const mappedId = (firstAidCategoryAliases as any)[slugify(label)] || rawId;

  return {
    id: mappedId,
    backendId: String(category.first_aid_category_id || category.id || ""),
    label,
  };
}

function getBlogCategoryId(category: any) {
  return (blogCategoryAliases as any)[slugify(category?.category_name)] || String(category?.post_category_id || "care");
}

function getFirstAidCategoryId(category: any) {
  return (firstAidCategoryAliases as any)[slugify(category?.category_name)] || String(category?.first_aid_category_id || "accident");
}

export function normalizePost(post: any = {}) {
  const category = post.category || {};
  const categoryLabel = category.category_name || "Kiến thức";
  const contentText = post.content || post.excerpt || "";
  const paragraphs = (String(contentText)
    .split(/\n{2,}|\r?\n/)
    .map((item: any) => item.trim())
    .filter(Boolean) as any[]);

  return {
    ...post,
    id: post.slug || String(post.post_id || post.id || ""),
    backendId: String(post.post_id || ""),
    section: post.post_type === "community" ? "community" : "knowledge",
    category: getBlogCategoryId(category),
    categoryLabel,
    title: post.title || "Bài viết",
    excerpt: post.excerpt || paragraphs[0] || "Thông tin hữu ích giúp bạn chăm sóc thú cưng mỗi ngày.",
    content: contentText,
    paragraphs,
    image: post.thumbnail_url || blogImages.postPlaceholder,
    author: post.author?.full_name || "Dr. Pet's House",
    authorImage: post.author?.avatar_url || blogImages.authorMinhAnh,
    publishedAt: formatDate(post.created_at),
    intro: post.excerpt || paragraphs[0] || "",
    description: paragraphs.slice(0, 2).join("\n\n") || post.excerpt || "",
    highlightTitle: "Điểm cần lưu ý",
    highlightText: paragraphs[2] || post.excerpt || "Theo dõi tình trạng thú cưng và liên hệ bác sĩ thú y khi có dấu hiệu bất thường.",
    schedule: paragraphs.slice(3, 6).length
      ? paragraphs.slice(3, 6)
      : ["Quan sát dấu hiệu bất thường.", "Chuẩn bị thông tin sức khỏe cần thiết.", "Liên hệ bác sĩ thú y khi cần hỗ trợ."],
    tags: post.hashtags
      ? (String(post.hashtags).split(/[,\s]+/).filter(Boolean) as any[]).map((tag: any) => (tag.startsWith("#") ? tag : `#${tag}`))
      : [`#${slugify(categoryLabel) || "petcare"}`],
    commentsCount: post._count?.comments || post.commentsCount || 0,
    likesCount: post.likes_count || 0,
    views: post.view_count || 0,
  };
}

function normalizePostComment(comment: any = {}) {
  const replies = Array.isArray(comment.children)
    ? comment.children.map((child: any) => ({
        id: child.comment_id || child.id,
        author: child.user?.full_name || "Người dùng",
        avatar: child.user?.avatar_url || "",
        content: child.content || "",
        replyTo: comment.user?.full_name || null,
        time: formatDate(child.created_at),
      }))
    : [];

  return {
    id: comment.comment_id || comment.id,
    author: comment.user?.full_name || "Người dùng",
    avatar: comment.user?.avatar_url || "",
    content: comment.content || "",
    time: formatDate(comment.created_at),
    replies,
  };
}

export function normalizeFirstAidGuide(guide: any = {}, index: any = 0) {
  const category = guide.category || {};
  const mediaImage = guide.media?.find?.((item: any) => item.media_type === "image")?.file_url;
  const stepImage = guide.steps?.find?.((step: any) => step.image_url)?.image_url;
  const image =
    guide.thumbnail_url ||
    guide.cover_image_url ||
    guide.image_url ||
    mediaImage ||
    stepImage ||
    blogImages.postPlaceholder;
  const urgent = /hoc|nghet|kho tho|cap cuu|soc|ngo doc/i.test(slugify(`${guide.title} ${guide.situation_description}`));
  const steps = (guide.steps || []).map((step: any) => ({
    title: `Bước ${step.step_number}`,
    description: step.step_content,
  }));

  return {
    ...guide,
    id: guide.slug || String(guide.guide_id || ""),
    backendId: String(guide.guide_id || ""),
    category: getFirstAidCategoryId(category),
    categoryLabel: category.category_name || "Sơ cứu",
    variant: urgent || index === 0 ? "urgent" : image ? "image" : "text",
    urgent,
    image,
    title: guide.title || "Hướng dẫn sơ cứu",
    heroTitle: guide.title || "Hướng dẫn sơ cứu",
    description: guide.situation_description || "Các bước xử lý ban đầu trước khi đưa thú cưng đến cơ sở thú y.",
    steps: steps.length
      ? steps
      : [
          { title: "Giữ bình tĩnh", description: "Đưa thú cưng đến khu vực an toàn và hạn chế kích động." },
          { title: "Quan sát dấu hiệu", description: "Ghi nhận triệu chứng, thời điểm xảy ra và các yếu tố liên quan." },
          { title: "Liên hệ bác sĩ", description: "Gọi phòng khám hoặc đưa thú cưng đi cấp cứu khi tình trạng nặng." },
        ],
    video: {
      title: guide.video_url ? "Xem video hướng dẫn chi tiết" : "Hướng dẫn xử lý an toàn",
      description: guide.video_url || "Thực hiện các bước sơ cứu nhẹ nhàng, tránh tự dùng thuốc khi chưa có chỉ định.",
      highlights: ["Giữ đường thở thông thoáng", "Theo dõi phản ứng của thú cưng"],
      url: guide.video_url || "",
    },
    emergencyPhone: guide.emergency_phone || "0868686868",
  };
}

@Injectable({ providedIn: 'root' })
export class ContentApiService {
  private readonly http = inject(CustomerHttpService);

  async getBlogCategories() {
    try {
      const response = await this.http.get("/post-categories");
      const data = assertSuccess(response);
      const list = Array.isArray(data) ? data : [];
      return [{ id: "all", label: "Tất cả", backendId: "" }, ...list.map(normalizeBlogCategory)];
    } catch {
      return [{ id: "all", label: "Tất cả", backendId: "" }];
    }
  }

  async getFeaturedPost() {
    try {
      const response = await this.http.get("/posts/featured");
      const post = assertSuccess(response);
      return post ? normalizePost(post) : null;
    } catch {
      return null;
    }
  }

  async getTrendingPosts(limit: any = 5) {
    try {
      const response = await this.http.get("/posts/trending", { params: { limit } });
      const data = assertSuccess(response);
      const list = Array.isArray(data) ? data : [];
      return list.map(normalizePost);
    } catch {
      return [];
    }
  }

  async getPostsPage(params: any = {}) {
    const response = await this.http.get("/posts", { params });
    const payload = assertSuccess(response);
    const posts = Array.isArray(payload.posts) ? payload.posts : [];
    return {
      posts: posts.map(normalizePost),
      totalRows: Number(payload.totalRows ?? posts.length),
      totalPages: Number(payload.totalPages || 1),
    };
  }

  async getPostBySlug(slug: any) {
    const response = await this.http.get(`/posts/${slug}`);
    return normalizePost(assertSuccess(response));
  }

  async getFirstAidCategories() {
    const response = await this.http.get("/first-aid/categories");
    return [{ id: "all", label: "Tất cả", backendId: "" }, ...assertSuccess(response).map(normalizeFirstAidCategory)];
  }

  async getFirstAidGuidesPage(params: any = {}) {
    const response = await this.http.get("/first-aid/guides", { params });
    const payload = assertSuccess(response);
    const rawGuides = payload.guides || [];
    const guides = await Promise.all(
      rawGuides.map(async (guide: any, index: any) => {
        const normalizedGuide = normalizeFirstAidGuide(guide, index);
        const needsDetailImage = normalizedGuide.image === blogImages.postPlaceholder && guide.slug;
  
        if (!needsDetailImage) return normalizedGuide;
  
        try {
          const detailResponse = await this.http.get(`/first-aid/guides/${guide.slug}`);
          const detail = assertSuccess(detailResponse);
          return normalizeFirstAidGuide({ ...guide, ...detail }, index);
        } catch {
          return normalizedGuide;
        }
      }),
    );
  
    return {
      guides,
      totalRows: Number(payload.totalRows || 0),
      totalPages: Number(payload.totalPages || 1),
    };
  }

  async getFirstAidGuideBySlug(slug: any) {
    const response = await this.http.get(`/first-aid/guides/${slug}`);
    return normalizeFirstAidGuide(assertSuccess(response));
  }

  async getPostComments(postId: any, params: any = {}) {
    const response = await this.http.get(`/posts/${postId}/comments`, { params });
    const payload = assertSuccess(response);
    return {
      comments: Array.isArray(payload?.comments) ? payload.comments.map(normalizePostComment) : [],
      totalRows: Number(payload?.totalRows || 0),
      totalPages: Number(payload?.totalPages || 1),
    };
  }

  async createPostComment(postId: any, content: any) {
    const response = await this.http.post(`/posts/${postId}/comments`, { content });
    return assertSuccess(response);
  }

  async replyPostComment(commentId: any, content: any) {
    const response = await this.http.post(`/posts/comments/${commentId}/reply`, { content });
    return assertSuccess(response);
  }

  async togglePostLike(postId: any) {
    const response = await this.http.post(`/posts/${postId}/like`);
    return assertSuccess(response);
  }
}
