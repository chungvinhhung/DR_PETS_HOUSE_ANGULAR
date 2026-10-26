/**
 * Hằng số & hàm tiện ích dùng chung cho các component trong thư mục này.
 * (Chuyển từ phần code nằm ngoài component trong React: src/pages/Blog/CommunityPage.jsx)
 */
import { blogImages } from '../../../../../shared/customer/assets/blog-images';
import { COMMUNITY_POSTS, FEATURED_COMMUNITY_POST, INITIAL_COMMUNITY_COMMENTS } from '../../../../../shared/customer/data/community-data';

export const POST_TYPES = {
  "Khoảnh khắc": "bg-[#E3F2FD] text-[#005AB4]",
  "Hỏi đáp": "bg-[#F3E8EE] text-[#672950]",
  "Mẹo vặt": "bg-[#DDF4F1] text-[#346461]",
  "Kinh nghiệm": "bg-[#FFF1D6] text-[#8A5700]",
};

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
  return normalizeCommunityPost({
    ...post,
    backendId: post.backendId || post.id,
    author: post.author,
    avatar: post.authorImage,
    time: post.publishedAt,
    image: post.image,
    content: post.description || post.excerpt,
    type: post.categoryLabel,
    likes: post.likesCount,
    comments: post.commentsCount,
    tags: post.tags,
  });
}

export function splitBalanced(posts: any) {
  const columns: any = [[], []];
  posts.forEach((post: any, index: any) => (columns as any)[index % 2].push(post));
  return columns;
}

