/**
 * Shared taxonomy for Customer community tags and Admin community type filters.
 * Persist the exact Vietnamese label in CommunityPost.type until BE publishes a
 * dedicated enum contract; never infer a category from post text.
 */
export const COMMUNITY_POST_TYPES = {
  'Khoảnh khắc': 'bg-[#E3F2FD] text-[#005AB4]',
  'Hỏi đáp': 'bg-[#F3E8EE] text-[#672950]',
  'Mẹo vặt': 'bg-[#DDF4F1] text-[#346461]',
  'Kinh nghiệm': 'bg-[#FFF1D6] text-[#8A5700]',
} as const;

export type CommunityPostType = keyof typeof COMMUNITY_POST_TYPES;
export const COMMUNITY_POST_TYPE_LABELS = Object.keys(COMMUNITY_POST_TYPES) as CommunityPostType[];
