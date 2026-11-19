/**
 * TÌM KIẾM THÔNG MINH (Nhiệm vụ 11) — các hàm thuần, không gọi API.
 *
 * Bù cho các giới hạn hiện tại của backend /search:
 *  1. Không nhận từ khóa có dấu cách ("thức ăn mèo" -> 400 VALIDATION_ERROR)
 *     => tách câu thành từ khóa đơn, gọi song song rồi gộp + xếp hạng lại ở FE.
 *  2. Phân biệt dấu ("meo" chỉ ra 1 kết quả, "mèo" ra 66)
 *     => khôi phục dấu cho các cụm từ phổ biến trong ngành thú cưng khi người dùng gõ không dấu.
 *  3. Không hiểu từ đồng nghĩa ("dog", "cat food") => ánh xạ sang tiếng Việt.
 */
import { removeVietnameseTones } from '../../../shared/customer/utils/slug';

/** Cụm từ không dấu / tiếng Anh -> tiếng Việt có dấu. Ưu tiên cụm dài trước. */
const PHRASE_DICTIONARY: Record<string, string> = {
  'thuc an hat': 'thức ăn hạt',
  'cat ve sinh': 'cát vệ sinh',
  'cat dau phu': 'cát đậu phụ',
  'khay ve sinh': 'khay vệ sinh',
  'sua tam': 'sữa tắm',
  'thuc an': 'thức ăn',
  'do an': 'đồ ăn',
  'do choi': 'đồ chơi',
  'do dung': 'đồ dùng',
  'phu kien': 'phụ kiện',
  've sinh': 'vệ sinh',
  'cham soc': 'chăm sóc',
  'suc khoe': 'sức khỏe',
  'dinh duong': 'dinh dưỡng',
  'huan luyen': 'huấn luyện',
  'banh thuong': 'bánh thưởng',
  'vong co': 'vòng cổ',
  'day dat': 'dây dắt',
  'bat an': 'bát ăn',
  'chuong': 'chuồng',
  'nem': 'nệm',
  'cat food': 'thức ăn mèo',
  'dog food': 'thức ăn chó',
  'cat litter': 'cát vệ sinh',
};

/** Từ đơn không dấu / tiếng Anh -> có dấu (dùng sau khi đã thay cụm từ). */
const WORD_DICTIONARY: Record<string, string> = {
  meo: 'mèo',
  hat: 'hạt',
  pate: 'pate',
  sua: 'sữa',
  tam: 'tắm',
  bat: 'bát',
  khay: 'khay',
  luoc: 'lược',
  dem: 'đệm',
  ao: 'áo',
  thuoc: 'thuốc',
  vitamin: 'vitamin',
  xuong: 'xương',
  gam: 'gặm',
  bong: 'bóng',
  ca: 'cá',
  ga: 'gà',
  bo: 'bò',
  dog: 'chó',
  puppy: 'chó',
  kitten: 'mèo',
  toy: 'đồ chơi',
  food: 'thức ăn',
  shampoo: 'sữa tắm',
  grooming: 'grooming',
};

/** Từ không mang nghĩa tìm kiếm (so khớp dạng có dấu). "chó" khác "cho" nên không bị loại. */
const STOPWORDS = new Set(['cho', 'của', 'và', 'các', 'những', 'dành', 'loại', 'với', 'là', 'cái', 'mua', 'tìm', 'giá', 'rẻ']);

/** Từ xuất hiện ở rất nhiều sản phẩm -> ít giá trị để lọc, gửi lên API sau cùng. */
const GENERIC_TERMS = new Set(['mèo', 'chó', 'thú', 'cưng', 'pet', 'đồ', 'ăn', 'cho']);

export const PET_TERMS = ['mèo', 'chó'] as const;
/** Các loài khác có trong catalog — dùng để nhận biết sản phẩm "sai loài" */
const SPECIES_TERMS = ['mèo', 'chó', 'vẹt', 'chim', 'thỏ', 'hamster', 'bọ ú', 'cá cảnh', 'rùa'];

const MAX_API_KEYWORDS = 3;

export interface SearchQueryAnalysis {
  /** Câu người dùng gõ */
  original: string;
  /** Câu đã chuẩn hóa + khôi phục dấu, dùng để hiển thị ("Kết quả cho: thức ăn mèo") */
  display: string;
  /** Các từ có nghĩa (đã bỏ stopword) dùng để chấm điểm */
  terms: string[];
  /** Tối đa 3 từ khóa đơn gửi lên backend, từ "đặc trưng" nhất trước */
  apiKeywords: string[];
  /** Thú cưng được nhắc tới trong câu tìm kiếm (để ưu tiên gợi ý bán chéo) */
  pet: (typeof PET_TERMS)[number] | null;
}

function hasVietnameseTones(value: string): boolean {
  return removeVietnameseTones(value) !== value;
}

/** Chuẩn hóa để so khớp: thường, bỏ dấu, gộp khoảng trắng. */
export function foldText(value: unknown): string {
  return removeVietnameseTones(String(value ?? '').toLowerCase()).replace(/\s+/g, ' ').trim();
}

function restoreTones(words: string[]): string[] {
  const result: string[] = [];
  const phrases = Object.keys(PHRASE_DICTIONARY).sort((a, b) => b.split(' ').length - a.split(' ').length);

  for (let index = 0; index < words.length; ) {
    const phrase = phrases.find((candidate) => {
      const parts = candidate.split(' ');
      return parts.every((part, offset) => words[index + offset] === part);
    });
    if (phrase) {
      result.push(...PHRASE_DICTIONARY[phrase].split(' '));
      index += phrase.split(' ').length;
      continue;
    }

    const word = words[index];
    if (word === 'cho') {
      // "thuc an cho meo" -> "cho" là giới từ; "vong co cho" / "cho" đứng một mình -> "chó"
      const next = words[index + 1];
      result.push(next && ['meo', 'cho', 'be', 'thu', 'pet'].includes(next) ? 'cho' : 'chó');
    } else {
      result.push(WORD_DICTIONARY[word] ?? word);
    }
    index += 1;
  }
  return result.join(' ').split(' ');
}

export function analyzeSearchQuery(raw: unknown): SearchQueryAnalysis {
  const original = String(raw ?? '').trim();
  const cleaned = original
    .toLowerCase()
    .normalize('NFC')
    .replace(/[^\p{L}\p{N}\s.-]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const words = cleaned ? cleaned.split(' ') : [];
  // Chỉ khôi phục dấu khi người dùng gõ hoàn toàn không dấu (gõ có dấu thì tôn trọng nguyên văn)
  const restored = words.length && !hasVietnameseTones(cleaned) ? restoreTones(words) : words;
  const display = restored.join(' ');

  const terms = Array.from(new Set(restored.filter((word) => word.length >= 2 && !STOPWORDS.has(word))));
  const fallbackTerms = terms.length ? terms : restored.filter(Boolean);

  const apiKeywords = [...fallbackTerms]
    .sort((a, b) => Number(GENERIC_TERMS.has(a)) - Number(GENERIC_TERMS.has(b)) || b.length - a.length)
    .slice(0, MAX_API_KEYWORDS);

  const pet = PET_TERMS.find((petTerm) => restored.includes(petTerm)) ?? null;

  return { original, display, terms: fallbackTerms, apiKeywords, pet };
}

export interface RankFieldWeights {
  [field: string]: number;
}

const PRODUCT_FIELDS: RankFieldWeights = { name: 3, categoryName: 2, productCode: 2, description: 1 };
const SERVICE_FIELDS: RankFieldWeights = { name: 3, serviceType: 2, description: 1 };
const POST_FIELDS: RankFieldWeights = { title: 3, categoryLabel: 2, excerpt: 1 };
const FIELDS_BY_KIND = { product: PRODUCT_FIELDS, service: SERVICE_FIELDS, post: POST_FIELDS };

/**
 * Chấm điểm 1 mục theo các từ khóa:
 *  - Từ khóa CÓ dấu ("chó", "ăn") so khớp có dấu — tránh "chó" khớp nhầm giới từ "cho", "ăn" khớp "an toàn".
 *  - Từ khóa KHÔNG dấu ("royal", "kong") so khớp không dấu.
 *  - Khớp nguyên từ = trọng số đầy đủ; khớp một phần (trong từ khác) = 40%.
 */
function scoreItem(item: any, terms: string[], fields: RankFieldWeights) {
  const fieldTexts = Object.entries(fields).map(([field, weight]) => ({
    toned: toneWords(item?.[field]),
    folded: ` ${foldText(item?.[field]).replace(/[^a-z0-9]+/g, ' ').trim()} `,
    weight,
  }));
  let matched = 0;
  let score = 0;
  for (const term of terms) {
    const toned = hasVietnameseTones(term);
    const needle = toned ? term : foldText(term);
    let best = 0;
    for (const field of fieldTexts) {
      const text = toned ? field.toned : field.folded;
      if (text.trim() === '') continue;
      const value = text.includes(` ${needle} `) ? field.weight : text.includes(needle) ? field.weight * 0.4 : 0;
      best = Math.max(best, value);
    }
    if (best > 0) matched += 1;
    score += best;
  }
  // Thưởng khi 2 từ liền nhau trong câu tìm cũng đứng liền nhau trong tên/mô tả
  // ("sữa tắm" > "xương vị sữa ... tắm"; mô tả có "hỗ trợ tiêu hóa" khi tìm "tiêu hóa")
  for (let index = 0; index < terms.length - 1; index += 1) {
    const pair = `${terms[index]} ${terms[index + 1]}`;
    const toned = hasVietnameseTones(pair);
    const needle = ` ${toned ? pair : foldText(pair)} `;
    score += Math.max(0, ...fieldTexts.filter((field) => (toned ? field.toned : field.folded).includes(needle)).map((field) => field.weight));
  }
  return { matched, score };
}

function normalizeTerms(terms: string[]): string[] {
  return Array.from(new Set(terms.map((term) => term.toLowerCase().normalize('NFC').trim()).filter(Boolean)));
}

/**
 * Xếp hạng lại kết quả gộp từ nhiều lần gọi API: ưu tiên mục khớp NHIỀU từ khóa nhất,
 * sau đó tới điểm trọng số (tên > danh mục > mô tả), cuối cùng giữ thứ tự gốc của backend.
 * Loại các mục chỉ khớp quá ít từ (< 60%) khi câu có nhiều từ.
 */
export function rankSearchItems<T>(items: T[], terms: string[], kind: keyof typeof FIELDS_BY_KIND = 'product'): T[] {
  const normalizedTerms = normalizeTerms(terms);
  if (!normalizedTerms.length) return items;
  const fields = FIELDS_BY_KIND[kind];

  const scored = items.map((item, index) => {
    const { matched, score } = scoreItem(item, normalizedTerms, fields);
    // Mục do backend trả về chắc chắn khớp >= 1 từ khóa (có thể ở trường FE không thấy)
    return { item, index, score, matched: Math.max(matched, 1) };
  });
  const minMatched = normalizedTerms.length <= 1 ? 1 : Math.ceil(normalizedTerms.length * 0.6);
  let kept = scored.filter((entry) => entry.matched >= minMatched);
  if (!kept.length) kept = scored;

  return kept
    .sort((a, b) => b.matched - a.matched || b.score - a.score || a.index - b.index)
    .map((entry) => entry.item);
}

/**
 * Lọc danh sách do FE tự có (chỉ mục sản phẩm cục bộ): KHÁC rankSearchItems ở chỗ mục không khớp
 * từ nào ở tên / danh mục / mô tả sẽ bị loại. Không phân biệt dấu khi người dùng gõ không dấu
 * ("tieu hoa" khớp "tiêu hóa" trong mô tả).
 */
export function filterByTerms<T>(items: T[], terms: string[], kind: keyof typeof FIELDS_BY_KIND = 'product'): T[] {
  const normalizedTerms = normalizeTerms(terms);
  if (!normalizedTerms.length) return [];
  const fields = FIELDS_BY_KIND[kind];
  const minMatched = normalizedTerms.length <= 1 ? 1 : Math.ceil(normalizedTerms.length * 0.6);
  return items
    .map((item, index) => ({ item, index, ...scoreItem(item, normalizedTerms, fields) }))
    .filter((entry) => entry.matched >= minMatched)
    .sort((a, b) => b.matched - a.matched || b.score - a.score || a.index - b.index)
    .map((entry) => entry.item);
}

/** Một đoạn chữ của đoạn trích; hit = true là từ khóa (tô sáng). */
export interface SnippetSegment {
  text: string;
  hit: boolean;
}

/**
 * Bản "so khớp được" của 1 chuỗi, GIỮ NGUYÊN độ dài để vị trí khớp trỏ đúng chuỗi gốc:
 * toned = chữ thường có dấu; folded = bỏ dấu từng ký tự (ký tự nào bỏ dấu ra != 1 ký tự thì giữ nguyên).
 */
function searchableForms(text: string) {
  const toned = text.toLowerCase();
  const folded = Array.from(toned, (char) => {
    const plain = removeVietnameseTones(char);
    return plain.length === char.length ? plain : char;
  }).join('');
  return { toned, folded };
}

function findTermRanges(text: string, terms: string[]): Array<[number, number]> {
  const forms = searchableForms(text);
  const ranges: Array<[number, number]> = [];
  for (const term of terms) {
    const toned = hasVietnameseTones(term);
    const haystack = toned ? forms.toned : forms.folded;
    const needle = toned ? term : foldText(term);
    if (!needle) continue;
    // Từ ngắn ("ăn", "da") phải khớp nguyên từ, tránh tô "ăn" trong "chăn", "da" trong "dạng"
    const wholeWordOnly = needle.length <= 3;
    const isWordChar = (char: string | undefined) => Boolean(char && /[\p{L}\p{N}]/u.test(char));
    for (let from = haystack.indexOf(needle); from >= 0; from = haystack.indexOf(needle, from + needle.length)) {
      const to = from + needle.length;
      if (wholeWordOnly && (isWordChar(haystack[from - 1]) || isWordChar(haystack[to]))) continue;
      ranges.push([from, to]);
    }
  }
  // Gộp các đoạn chồng / liền nhau ("tiêu" + " " + "hóa" -> "tiêu hóa")
  ranges.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const range of ranges) {
    const last = merged[merged.length - 1];
    if (last && range[0] <= last[1] + 1 && /^\s?$/.test(text.slice(last[1], range[0]))) last[1] = Math.max(last[1], range[1]);
    else merged.push([...range]);
  }
  return merged;
}

/**
 * Đoạn trích ~2*radius ký tự quanh vị trí khớp ĐẦU TIÊN trong `text`, đã chia thành segment để tô sáng
 * (render bằng @for, không dùng innerHTML -> không có rủi ro XSS từ mô tả sản phẩm).
 */
export function buildMatchSnippet(text: unknown, terms: string[], radius = 60): SnippetSegment[] {
  const source = String(text ?? '').normalize('NFC').replace(/\s+/g, ' ').trim();
  const normalizedTerms = normalizeTerms(terms);
  if (!source || !normalizedTerms.length) return [];
  const ranges = findTermRanges(source, normalizedTerms);
  if (!ranges.length) return [];

  let start = Math.max(0, ranges[0][0] - radius);
  let end = Math.min(source.length, ranges[0][1] + radius);
  // Cắt ở ranh giới từ cho dễ đọc
  if (start > 0) start = source.indexOf(' ', start) + 1 || start;
  if (end < source.length) end = source.lastIndexOf(' ', end) > ranges[0][1] ? source.lastIndexOf(' ', end) : end;

  const segments: SnippetSegment[] = [];
  let cursor = start;
  for (const [from, to] of ranges) {
    if (to <= start || from >= end) continue;
    const hitStart = Math.max(from, start);
    const hitEnd = Math.min(to, end);
    if (hitStart > cursor) segments.push({ text: source.slice(cursor, hitStart), hit: false });
    segments.push({ text: source.slice(hitStart, hitEnd), hit: true });
    cursor = hitEnd;
  }
  if (cursor < end) segments.push({ text: source.slice(cursor, end), hit: false });
  if (start > 0) segments.unshift({ text: '…', hit: false });
  if (end < source.length) segments.push({ text: '…', hit: false });
  return segments;
}

/**
 * Đánh dấu VÌ SAO 1 sản phẩm khớp: nếu có từ khóa chỉ xuất hiện trong MÔ TẢ (không có trong tên/danh mục)
 * thì trả về đoạn trích mô tả có tô sáng để hiển thị dưới thẻ sản phẩm.
 */
export function describeMatch(product: any, terms: string[]): { matchedInDescription: boolean; matchSnippet: SnippetSegment[] } {
  const normalizedTerms = normalizeTerms(terms);
  const titleText = `${product?.name ?? ''} ${product?.categoryName ?? ''} ${product?.productCode ?? ''}`;
  const titleRanges = (term: string) => findTermRanges(titleText, [term]).length > 0;
  const descriptionOnly = normalizedTerms.filter((term) => !titleRanges(term) && findTermRanges(String(product?.description ?? ''), [term]).length > 0);
  if (!descriptionOnly.length) return { matchedInDescription: false, matchSnippet: [] };
  return { matchedInDescription: true, matchSnippet: buildMatchSnippet(product.description, normalizedTerms) };
}

/** Gộp nhiều danh sách theo id, giữ bản xuất hiện đầu tiên. */
export function mergeById<T>(lists: T[][], getId: (item: T) => unknown): T[] {
  const seen = new Set<string>();
  const merged: T[] = [];
  for (const list of lists) {
    for (const item of list ?? []) {
      const id = String(getId(item) ?? '');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      merged.push(item);
    }
  }
  return merged;
}

/** Tách từ GIỮ DẤU: không được bỏ dấu ở đây vì "chó" (loài) và "cho" (giới từ) sẽ thành một. */
function toneWords(value: unknown): string {
  return ` ${String(value ?? '').toLowerCase().normalize('NFC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim()} `;
}

/** Thú cưng được nhắc trong 1 đoạn chữ (so khớp có dấu). */
export function detectPet(value: unknown): (typeof PET_TERMS)[number] | null {
  const words = toneWords(value);
  return PET_TERMS.find((pet) => words.includes(` ${pet} `)) ?? null;
}

function speciesRank(item: { name?: unknown }, pet: string): 0 | 1 | 2 {
  const name = toneWords(item.name);
  if (name.includes(` ${pet} `)) return 0;
  return SPECIES_TERMS.some((other) => other !== pet && name.includes(` ${other} `)) ? 2 : 1;
}

/**
 * Gợi ý bán chéo: đúng loài lên trước (0), dùng chung ở giữa (1); sản phẩm chỉ dành cho loài KHÁC (2) bị bỏ
 * — không gợi ý thức ăn cho vẹt khi khách đang tìm đồ cho mèo.
 */
export function sortByPetAffinity<T extends { name?: unknown }>(items: T[], pet: string | null): T[] {
  if (!pet) return items;
  return items
    .map((item, index) => ({ item, index, rank: speciesRank(item, pet) }))
    .filter((entry) => entry.rank < 2)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.item);
}

/** Kết quả tìm kiếm: giữ nguyên thứ tự liên quan, chỉ đẩy sản phẩm dành cho loài khác xuống cuối. */
export function demoteOtherSpecies<T extends { name?: unknown }>(items: T[], pet: string | null): T[] {
  if (!pet) return items;
  const matching = items.filter((item) => speciesRank(item, pet) < 2);
  return matching.length === items.length ? items : [...matching, ...items.filter((item) => speciesRank(item, pet) === 2)];
}
