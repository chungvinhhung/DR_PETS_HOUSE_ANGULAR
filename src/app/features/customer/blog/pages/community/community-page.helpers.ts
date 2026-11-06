/**
 * Hằng số & hàm tiện ích dùng chung cho các component trong thư mục này.
 * (Chuyển từ phần code nằm ngoài component trong React: src/pages/Blog/CommunityPage.jsx)
 */
import { COMMUNITY_POST_TYPES } from '../../../../../shared/customer/data/community-post-types';

// Keep the existing Customer composer / badge API backed by the same four
// labels as the Admin Loại bài filter.
export const POST_TYPES = COMMUNITY_POST_TYPES;

export const EMPTY_COMMENTS: any = [];

export function normalizeCommunityPost(post: any) {
  return {
    ...post,
    content: post.content || post.paragraphs?.join("\n\n") || "",
    likes: post.likes ?? 0,
    comments: post.comments ?? 0,
  };
}

export function normalizeApiCommunityPost(post: any) {
  // API /community/posts returns CommunityPost documents, not Blog Post docs.
  const id=String(post._id || post.id || post.community_post_id || '');
  const rawDate=post.createdAt || post.publishedAt || post.created_at;
  const date=rawDate ? new Date(rawDate) : null;
  const imageUrls=Array.isArray(post.imageUrls)?post.imageUrls:
    (Array.isArray(post.image_urls)?post.image_urls:[]);
  return normalizeCommunityPost({
    ...post,
    id,
    backendId:id,
    author:post.authorNameSnapshot || post.authorCustomerId?.fullName || post.authorName || 'Thành viên',
    avatar:post.authorAvatarSnapshot || post.authorCustomerId?.avatarUrl || '',
    time:date && !Number.isNaN(date.getTime())?date.toLocaleDateString('vi-VN'):'',
    image:imageUrls[0] || post.image || '',
    content:post.content || '',
    type:post.type || post.category || '',
    likes:Number(post.likesCount ?? post.likes ?? 0),
    comments:Number(post.commentsCount ?? post.comments ?? 0),
    tags:Array.isArray(post.tags)?post.tags:[],
  });
}

export function splitBalanced(posts: any) {
  const columns: any = [[], []];
  posts.forEach((post: any, index: any) => (columns as any)[index % 2].push(post));
  return columns;
}

