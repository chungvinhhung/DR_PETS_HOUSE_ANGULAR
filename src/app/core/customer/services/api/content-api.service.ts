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
import { FIRST_AID_CATEGORIES } from '../../../../shared/customer/data/first-aid-data';

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

const firstAidCategoryAliases: Record<string, string> = {
  "tai-nan": "accident",
  "so-cuu-khan-cap": "accident",
  "khan-cap": "accident",
  "ngo-doc": "poisoning",
  "kho-tho": "breathing",
  "chan-thuong": "injury",
  "cham-soc-vet-thuong": "injury",
  "vet-thuong": "injury",
  "benh-ly": "breathing",
  "benh-ly-thuong-gap": "breathing",
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
  const label = typeof category === 'string' ? category : (category.category_name || category.name || category.label || "Chủ đề");
  const rawId = typeof category === 'string' ? slugify(category) : String(category.first_aid_category_id || category.id || slugify(label));
  const mappedId = (firstAidCategoryAliases as any)[slugify(label)] || rawId;

  return {
    id: mappedId,
    backendId: String(category.first_aid_category_id || category.id || ""),
    label,
  };
}

function getBlogCategoryId(category: any) {
  const label = typeof category === 'string'
    ? category : (category?.category_name || category?.label || category?.name || '');
  const key = slugify(label);
  return (blogCategoryAliases as any)[key] ||
    (['health','nutrition','psychology','grooming','care'].includes(key) ? key : String(category?.post_category_id || 'care'));
}

function getFirstAidCategoryId(category: any) {
  if (!category) return "accident";
  const name = typeof category === 'string' ? category : (category.category_name || category.name || category.label || "");
  const slug = slugify(name);
  return (firstAidCategoryAliases as any)[slug] || String(category.first_aid_category_id || category.id || slug || "accident");
}

export function normalizePost(post: any = {}) {
  const category = post.category || {};
  const categoryLabel = typeof category === 'string'
    ? category : (category.category_name || category.label || category.name || 'Kiến thức');
  const contentText = post.content || post.excerpt || "";
  // New Content Studio blocks are optional. Preserve the old plain-text
  // renderer when BE does not return these fields.
  const rawBlocks = post.contentBlocks || post.content_blocks;
  const contentBlocks = Array.isArray(rawBlocks)
    ? rawBlocks.filter((block: any) =>
        ['paragraph','heading','quote','list','image','video'].includes(block?.type) &&
        typeof block?.text === 'string' && block.text.trim())
      .map((block: any) => ({
        type:block.type, text:block.text,
        alt:typeof block.alt === 'string' ? block.alt : '',
        // Angular sanitizes contentBlocks.html again at [innerHTML] sinks.
        html:typeof block.html === 'string' ? block.html : ''
      }))
    : [];
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
    contentBlocks,
    layoutType: post.layoutType || post.layout_type || 'STANDARD',
    paragraphs,
    image: post.thumbnail_url || post.thumbnailUrl || post.coverImage || blogImages.postPlaceholder,
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
  const category = guide.category || guide.categoryId || guide.category_id || {};
  const mediaImage = guide.media?.find?.((item: any) => item.media_type === 'image')?.file_url;
  const stepImage = guide.steps?.find?.((step: any) => step.image_url || step.mediaUrl)?.image_url ||
    guide.steps?.find?.((step: any) => step.image_url || step.mediaUrl)?.mediaUrl;
  const image = guide.thumbnail_url || guide.thumbnailUrl || guide.thumbnail ||
    guide.cover_image_url || guide.image_url || mediaImage || stepImage || blogImages.postPlaceholder;
  const urgency = String(guide.urgencyLevel || guide.urgency_level || '').toUpperCase();
  const urgent = guide.urgent === true || ['URGENT','HIGH','EMERGENCY'].includes(urgency);
  const steps = (Array.isArray(guide.steps) ? guide.steps : []).map((step: any, sIdx: number) => ({
    title: step.title || `Bước ${step.step_number || step.stepNumber || sIdx + 1}`,
    description: step.step_content || step.instruction || step.description || '',
  }));
  const categoryLabel = typeof category === 'string'
    ? (FIRST_AID_CATEGORIES.find((item:any) => item.id === category)?.label || category)
    : (category.category_name || category.name || category.label ||
      FIRST_AID_CATEGORIES.find((item:any)=>item.id===guide.categoryId)?.label || 'Sơ cứu');
  const rawBadges = guide.step_badges ?? guide.stepBadges;
  // Only render badges returned by BE; never inject hardcoded tips into published guides.
  const stepBadges: string[] = Array.isArray(rawBadges)
    ? [...new Set<string>(
        rawBadges.filter((value: unknown): value is string => typeof value === 'string')
          .map((value: string) => value.trim().replace(/\s+/g, ' ').slice(0, 40))
          .filter((value: string) => Boolean(value)),
      )].slice(0, 6)
    : [];
  const videoUrl = String(guide.video_url || guide.videoUrl || guide.video?.url || '').trim();
  const videoHighlights = guide.video_highlights || guide.videoHighlights || guide.video?.highlights || [];
  return {
    ...guide,
    id: guide.slug || String(guide.guide_id || guide._id || guide.id || ''),
    backendId: String(guide.guide_id || guide._id || guide.id || ''),
    category: getFirstAidCategoryId(category),
    categoryLabel,
    variant: urgent ? 'urgent' : image ? 'image' : 'text',
    urgent,image,
    title: guide.title || 'Hướng dẫn sơ cứu',
    // The Admin editor uses one canonical title for both the guide and hero banner.
    heroTitle: guide.title || guide.heroTitle || guide.hero_title || 'Hướng dẫn sơ cứu',
    description: guide.situation_description || guide.situationDescription ||
      guide.excerpt || (guide.content ? String(guide.content).split('\n')[0] : ''),
    // Missing API steps are not an invitation to invent medical instructions.
    steps,
    stepBadges,
    video: videoUrl ? {
      title: guide.video_title || guide.videoTitle || guide.video?.title || 'Video hướng dẫn',
      description: guide.video_description || guide.videoDescription || guide.video?.description || '',
      highlights: Array.isArray(videoHighlights) ? videoHighlights :
        String(videoHighlights).split(/\r?\n/).filter(Boolean),
      url: videoUrl,
    } : null,
    emergencyPhone: guide.emergency_phone || guide.emergencyPhone || '0868686868',
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
    const posts = Array.isArray(payload)
      ? payload
      : (Array.isArray(payload?.posts) ? payload.posts : (Array.isArray(payload?.items) ? payload.items : []));
    return {
      posts: posts.map(normalizePost),
      totalRows: Number(payload?.totalRows ?? payload?.total ?? posts.length),
      totalPages: Number(payload?.totalPages || 1),
    };
  }

  async getPostBySlug(slug: any) {
    const response = await this.http.get(`/posts/${slug}`);
    return normalizePost(assertSuccess(response));
  }

  async getFirstAidCategories() {
    try {
      const response = await this.http.get("/first-aid/categories");
      const data = assertSuccess(response);
      const list = Array.isArray(data) ? data : (data?.items || []);
      return [{ id: "all", label: "Tất cả", backendId: "" }, ...list.map(normalizeFirstAidCategory)];
    } catch {
      return [{ id: "all", label: "Tất cả", backendId: "" }];
    }
  }

  async getFirstAidGuidesPage(params: any = {}) {
    const response = await this.http.get("/first-aid/guides", { params });
    const payload = assertSuccess(response);
    const rawGuides = Array.isArray(payload)
      ? payload
      : (payload?.guides || payload?.items || payload?.posts || []);
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
      totalRows: Number(payload?.totalRows ?? payload?.total ?? guides.length),
      totalPages: Number(payload?.totalPages || 1),
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
