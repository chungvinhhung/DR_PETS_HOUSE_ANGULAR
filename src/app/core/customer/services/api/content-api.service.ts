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
import { FIRST_AID_CATEGORIES, getFirstAidFallbackImage } from '../../../../shared/customer/data/first-aid-data';

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
  const label = typeof category === 'string' ? category : (category.name || category.category_name || category.label || category.title || "Chủ đề");
  const rawId = typeof category === 'string' ? slugify(category) : String(category.post_category_id || category.id || category.slug || slugify(label));
  const slug = category.slug || slugify(label);
  const mappedId = (blogCategoryAliases as any)[slug] || rawId;

  return {
    id: mappedId,
    backendId: String(category.post_category_id || category.id || ""),
    label,
    slug,
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
  if (!category) return "care";
  const name = typeof category === 'string' ? category : (category.name || category.category_name || category.label || "");
  const slug = slugify(name);
  return (blogCategoryAliases as any)[slug] || String(category.post_category_id || category.id || slug || "care");
}

function getFirstAidCategoryId(category: any) {
  if (!category) return "accident";
  const name = typeof category === 'string' ? category : (category.category_name || category.name || category.label || "");
  const slug = slugify(name);
  return (firstAidCategoryAliases as any)[slug] || String(category.first_aid_category_id || category.id || slug || "accident");
}

export function normalizePost(post: any = {}) {
  const category = post.category || {};
  const categoryLabel = typeof category === 'string' ? category : (category.category_name || category.name || category.label || "Kiến thức");
  const categoryId = typeof category === 'string' ? ((blogCategoryAliases as any)[slugify(category)] || slugify(category)) : getBlogCategoryId(category);
  const contentText = post.content || post.excerpt || "";
  const rawBlocks = post.contentBlocks || post.content_blocks;
  const contentBlocks = Array.isArray(rawBlocks)
    ? rawBlocks.filter((block: any) =>
        ['paragraph','heading','quote','list','image','video'].includes(block?.type) &&
        typeof block?.text === 'string' && block.text.trim())
      .map((block: any) => ({
        type: block.type,
        text: block.text,
        alt: typeof block.alt === 'string' ? block.alt : '',
        html: typeof block.html === 'string' ? block.html : ''
      }))
    : [];
  const paragraphs = (String(contentText)
    .split(/\n{2,}|\r?\n/)
    .map((item: any) => item.trim())
    .filter(Boolean) as any[]);

  return {
    ...post,
    id: post.slug || String(post._id || post.post_id || post.id || ""),
    backendId: String(post._id || post.post_id || post.id || ""),
    section: post.postType === "FIRST_AID" ? "first_aid" : (post.post_type === "community" ? "community" : "knowledge"),
    category: categoryId,
    categoryLabel,
    title: post.title || "Bài viết",
    excerpt: post.excerpt || paragraphs[0] || "Thông tin hữu ích giúp bạn chăm sóc thú cưng mỗi ngày.",
    content: contentText,
    contentBlocks,
    layoutType: post.layoutType || post.layout_type || 'standard',
    paragraphs,
    image: post.thumbnailUrl || post.thumbnail_url || post.thumbnail || blogImages.postPlaceholder,
    author: post.authorId?.fullName || post.author?.full_name || post.authorNameSnapshot || post.author || "Dr. Pet's House",
    authorImage: post.author?.avatar_url || post.authorAvatar || blogImages.authorMinhAnh,
    publishedAt: formatDate(post.publishedAt || post.createdAt || post.created_at || new Date()),
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
    likesCount: post.likesCount || post.likes_count || 0,
    views: post.viewCount || post.view_count || post.views || 0,
  };
}

export function normalizeCommunityPostFromApi(item: any = {}) {
  const author = item.authorNameSnapshot || item.authorCustomerId?.fullName || item.author?.full_name || item.author || "Thành viên yêu thú cưng";
  const imageUrl = (Array.isArray(item.imageUrls) && item.imageUrls[0]) || item.image || item.thumbnailUrl || null;
  const id = String(item._id || item.id || `comm-${Date.now()}`);
  return {
    ...item,
    id,
    backendId: String(item._id || item.id || ""),
    title: item.title || "",
    content: item.content || "",
    author,
    avatar: item.authorAvatarSnapshot || item.avatar || null,
    initials: author.slice(0, 1).toUpperCase(),
    time: formatDate(item.createdAt || item.created_at || new Date()),
    image: imageUrl,
    video: item.videoUrl || item.video || null,
    type: item.type || "Khoảnh khắc",
    likes: Number(item.likesCount ?? item.likes ?? 0),
    comments: Number(item.commentsCount ?? item.comments ?? 0),
    tags: Array.isArray(item.tags) ? item.tags : ["#cộng_đồng", "#thúcưng"],
  };
}

function normalizePostComment(comment: any = {}) {
  const author = comment.author || comment.user?.full_name || comment.user?.fullName || comment.user?.name || comment.authorName || "Người dùng";
  const avatar = comment.avatar || comment.user?.avatar_url || comment.user?.avatar || comment.user?.avatarUrl || comment.user?.photoUrl || "";
  const time = comment.time || (comment.created_at || comment.createdAt ? formatDate(comment.created_at || comment.createdAt) : "") || "Vừa xong";
  const userId = comment.userId || comment.user?.id || comment.user?._id || "";
  const isOwn = Boolean(comment.isOwn);

  const replies = Array.isArray(comment.children || comment.replies)
    ? (comment.children || comment.replies).map((child: any) => {
        const replyAuthor = child.author || child.user?.full_name || child.user?.fullName || child.user?.name || "Người dùng";
        const replyAvatar = child.avatar || child.user?.avatar_url || child.user?.avatar || child.user?.avatarUrl || child.user?.photoUrl || "";
        return {
          id: child.comment_id || child.id,
          author: replyAuthor,
          avatar: replyAvatar,
          content: child.content || "",
          replyTo: child.replyTo || comment.user?.full_name || comment.author || null,
          userId: child.userId || child.user?.id || child.user?._id || "",
          isOwn: Boolean(child.isOwn),
          time: child.time || (child.created_at || child.createdAt ? formatDate(child.created_at || child.createdAt) : "") || "Vừa xong",
        };
      })
    : [];

  return {
    id: comment.comment_id || comment.id,
    author,
    avatar,
    content: comment.content || "",
    time,
    userId,
    isOwn,
    replies,
  };
}

export function normalizeFirstAidGuide(guide: any = {}, index: any = 0) {
  const category = guide.category || {};
  const mediaImage = guide.media?.find?.((item: any) => item.media_type === "image")?.file_url;
  const stepImage = guide.steps?.find?.((step: any) => step.image_url || step.mediaUrl)?.image_url || guide.steps?.find?.((step: any) => step.image_url || step.mediaUrl)?.mediaUrl;
  const image =
    guide.thumbnail_url ||
    guide.thumbnailUrl ||
    guide.thumbnail ||
    guide.cover_image_url ||
    guide.image_url ||
    mediaImage ||
    stepImage ||
    getFirstAidFallbackImage(getFirstAidCategoryId(category));
  const urgency = String(guide.urgencyLevel || guide.urgency_level || '').toUpperCase();
  const urgent = guide.urgent === true || ['URGENT', 'HIGH', 'EMERGENCY'].includes(urgency);
  const steps = (guide.steps || []).map((step: any, sIdx: number) => ({
    title: step.title || `Bước ${step.step_number || step.stepNumber || sIdx + 1}`,
    description: step.step_content || step.instruction || step.description || "",
  }));
  const rawBadges = guide.stepBadges || guide.step_badges;
  const stepBadges = Array.isArray(rawBadges)
    ? rawBadges.filter((b: any) => typeof b === 'string' && b.trim())
    : ['Thực hiện chậm', 'Quan sát kỹ'];

  const categoryLabel = typeof category === 'string' ? category : (category.category_name || category.name || category.label || "Sơ cứu");

  return {
    ...guide,
    id: guide.slug || String(guide.guide_id || guide._id || guide.id || ""),
    backendId: String(guide.guide_id || guide._id || guide.id || ""),
    category: getFirstAidCategoryId(category),
    categoryLabel,
    variant: urgent || index === 0 ? "urgent" : image ? "image" : "text",
    urgent,
    image,
    title: guide.title || "Hướng dẫn sơ cứu",
    heroTitle: guide.title || "Hướng dẫn sơ cứu",
    description: guide.situation_description || guide.excerpt || (guide.content ? String(guide.content).split('\n')[0] : "Các bước xử lý ban đầu trước khi đưa thú cưng đến cơ sở thú y."),
    steps: steps.length
      ? steps
      : [
          { title: "Giữ bình tĩnh", description: "Đưa thú cưng đến khu vực an toàn và hạn chế kích động." },
          { title: "Quan sát dấu hiệu", description: "Ghi nhận triệu chứng, thời điểm xảy ra và các yếu tố liên quan." },
          { title: "Liên hệ bác sĩ", description: "Gọi phòng khám hoặc đưa thú cưng đi cấp cứu khi tình trạng nặng." },
        ],
    stepBadges,
    video: {
      title: guide.video_title || (guide.video_url ? "Xem video hướng dẫn chi tiết" : "Hướng dẫn xử lý an toàn"),
      description: guide.video_description || guide.video_url || "Thực hiện các bước sơ cứu nhẹ nhàng, tránh tự dùng thuốc khi chưa có chỉ định.",
      descriptionHtml: guide.video_description_html || guide.videoDescriptionHtml || "",
      highlights: Array.isArray(guide.video_highlights) && guide.video_highlights.length
        ? guide.video_highlights
        : ["Giữ đường thở thông thoáng", "Theo dõi phản ứng của thú cưng"],
      url: guide.video_url || "",
    },
    emergencyPhone: guide.emergency_phone || guide.emergencyPhone || "1900-PET-HELP",
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
      const single = Array.isArray(post) ? post[0] : (post?.items?.[0] || post);
      return single ? normalizePost(single) : null;
    } catch {
      return null;
    }
  }

  async getTrendingPosts(limit: any = 5) {
    try {
      const response = await this.http.get("/posts/trending", { params: { limit } });
      const data = assertSuccess(response);
      const list = Array.isArray(data) ? data : (data?.items || []);
      return list.map(normalizePost);
    } catch {
      return [];
    }
  }

  async getPostsPage(params: any = {}) {
    const queryParams: any = { ...params };
    if (params.type === 'official_blog') {
      queryParams.postType = 'OFFICIAL_BLOG';
    } else if (params.type === 'first_aid') {
      queryParams.postType = 'FIRST_AID';
    }
    const response = await this.http.get("/posts", { params: queryParams });
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

  async getCommunityPostsPage(params: any = {}) {
    const response = await this.http.get('/community/posts', { params });
    const payload = assertSuccess(response);
    const rawPosts = Array.isArray(payload)
      ? payload : (Array.isArray(payload?.items) ? payload.items :
        (Array.isArray(payload?.posts) ? payload.posts : []));
    // Public feed must never include known non-approved records. BE must enforce this as well.
    const posts = rawPosts
      .filter((item: any) => !item.status || String(item.status).toUpperCase() === 'APPROVED')
      .map(normalizeCommunityPostFromApi);
    return {
      posts,
      items: posts,
      totalRows: Number(payload?.totalRows ?? payload?.total ?? posts.length),
      total: Number(payload?.total ?? payload?.totalRows ?? posts.length),
      totalPages: Number(payload?.totalPages || 1),
      page: Number(payload?.page || 1),
    };
  }

  async getCommunityPosts(params: any = {}) {
    try {
      const res = await this.getCommunityPostsPage(params);
      return {
        items: res.posts,
        posts: res.posts,
        total: res.total,
        totalRows: res.totalRows,
        page: res.page,
        totalPages: res.totalPages,
      };
    } catch {
      return { items: [], posts: [], total: 0, totalRows: 0, page: 1, totalPages: 1 };
    }
  }

  async createCommunityPost(data: { title?: string; content: string; imageUrls?: string[]; type?: string }) {
    const response = await this.http.post("/community/posts", data);
    const resData = assertSuccess(response);
    return normalizeCommunityPostFromApi(resData);
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
        // Missing list thumbnails can still be present in the detailed guide.
        // Keep fetching the detail even though the rendered fallback is now a photo.
        const hasListImage = [
          guide.thumbnail_url, guide.thumbnailUrl, guide.thumbnail,
          guide.cover_image_url, guide.image_url,
          guide.media?.find?.((item: any) => item.media_type === 'image')?.file_url,
          guide.steps?.find?.((step: any) => step.image_url || step.mediaUrl)?.image_url,
        ].some((url: any) => typeof url === 'string' && url.trim());
        const needsDetailImage = !hasListImage && guide.slug;

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
    const rawComments = Array.isArray(payload)
      ? payload : Array.isArray(payload?.comments) ? payload.comments : [];
    const comments = rawComments.map(normalizePostComment);
    return {
      comments,
      totalRows: Number(payload?.totalRows ?? comments.length),
      totalPages: Number(payload?.totalPages ?? 1),
    };
  }

  async createPostComment(postId: any, content: any, authorInfo: any = {}) {
    const response = await this.http.post(`/posts/${postId}/comments`, { content });
    return assertSuccess(response);
  }

  async replyPostComment(first: any, second: any, third?: any, fourth: any = {}, fifth: any = '') {
    const commentId = typeof third === 'string' ? second : first;
    const content = typeof third === 'string' ? third : second;
    const response = await this.http.post(`/posts/comments/${commentId}/reply`, { content });
    return assertSuccess(response);
  }

  async togglePostLike(postId: any) {
    const response = await this.http.post(`/posts/${postId}/like`);
    return assertSuccess(response);
  }
}
