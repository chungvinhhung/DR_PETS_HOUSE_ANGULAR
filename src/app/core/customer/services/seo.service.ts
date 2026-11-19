import { DOCUMENT } from '@angular/common';
import { inject, Injectable } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';

const SITE_NAME = "Dr. Pet's House";
const DEFAULT_TITLE = "Dr. Pet's House - Trung tâm chăm sóc thú cưng";
const DEFAULT_DESCRIPTION =
  "Dr. Pet's House - phòng khám, grooming và cửa hàng thú cưng: thức ăn, phụ kiện, đồ chơi cho chó mèo chính hãng.";
const JSON_LD_SCRIPT_ID = 'seo-json-ld';
const MAX_DESCRIPTION_LENGTH = 160;

export interface SeoPageConfig {
  title: string;
  description?: string;
  /** Đường dẫn chuẩn (vd. /san-pham/abc-i.123). Bỏ trống -> dùng URL hiện tại, bỏ query string. */
  canonicalPath?: string;
  image?: string;
  type?: 'website' | 'product' | 'article';
  /** false -> <meta name="robots" content="noindex,follow"> (vd. trang tìm kiếm có bộ lọc) */
  index?: boolean;
  jsonLd?: Record<string, unknown> | null;
}

/**
 * Quản lý thẻ SEO trong <head> cho trang khách hàng (Nhiệm vụ 12):
 * title, meta description, canonical, robots, Open Graph và dữ liệu cấu trúc JSON-LD.
 *
 * Lưu ý: app đang render phía client (CSR). Googlebot chạy JS nên đọc được các thẻ này;
 * các bot không chạy JS (Facebook, Zalo) cần SSR/prerender mới thấy (xem docs/TASK-12).
 */
@Injectable({ providedIn: 'root' })
export class SeoService {
  private readonly document = inject(DOCUMENT);
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  setPage(config: SeoPageConfig): void {
    const fullTitle = config.title.includes(SITE_NAME) ? config.title : `${config.title} | ${SITE_NAME}`;
    const description = this.toDescription(config.description) || DEFAULT_DESCRIPTION;
    const canonicalUrl = this.toAbsoluteUrl(config.canonicalPath ?? this.document.location.pathname);

    this.title.setTitle(fullTitle);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ name: 'robots', content: config.index === false ? 'noindex,follow' : 'index,follow' });

    this.meta.updateTag({ property: 'og:site_name', content: SITE_NAME });
    this.meta.updateTag({ property: 'og:locale', content: 'vi_VN' });
    this.meta.updateTag({ property: 'og:type', content: config.type ?? 'website' });
    this.meta.updateTag({ property: 'og:title', content: fullTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ property: 'og:url', content: canonicalUrl });
    if (config.image) {
      this.meta.updateTag({ property: 'og:image', content: this.toAbsoluteUrl(config.image) });
    } else {
      this.meta.removeTag("property='og:image'");
    }

    this.setCanonical(canonicalUrl);
    this.setJsonLd(config.jsonLd ?? null);
  }

  /** Trả <head> về mặc định khi rời trang (tránh trang sau "dính" SEO của trang trước). */
  reset(): void {
    this.title.setTitle(DEFAULT_TITLE);
    this.meta.updateTag({ name: 'description', content: DEFAULT_DESCRIPTION });
    this.meta.updateTag({ name: 'robots', content: 'index,follow' });
    ['og:type', 'og:title', 'og:description', 'og:url', 'og:image'].forEach((property) =>
      this.meta.removeTag(`property='${property}'`),
    );
    this.document.head.querySelector('link[rel="canonical"]')?.remove();
    this.setJsonLd(null);
  }

  private setCanonical(url: string): void {
    let link = this.document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!link) {
      link = this.document.createElement('link');
      link.setAttribute('rel', 'canonical');
      this.document.head.appendChild(link);
    }
    link.setAttribute('href', url);
  }

  private setJsonLd(data: Record<string, unknown> | null): void {
    this.document.getElementById(JSON_LD_SCRIPT_ID)?.remove();
    if (!data) return;
    const script = this.document.createElement('script');
    script.id = JSON_LD_SCRIPT_ID;
    script.type = 'application/ld+json';
    // Chặn chuỗi "</script>" trong dữ liệu sản phẩm phá vỡ thẻ script
    script.textContent = JSON.stringify(data).replace(/</g, '\\u003c');
    this.document.head.appendChild(script);
  }

  private toDescription(value: string | undefined): string {
    const text = String(value ?? '').replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
    if (text.length <= MAX_DESCRIPTION_LENGTH) return text;
    const cut = text.slice(0, MAX_DESCRIPTION_LENGTH - 1);
    return `${cut.slice(0, cut.lastIndexOf(' ') > 100 ? cut.lastIndexOf(' ') : cut.length)}…`;
  }

  private toAbsoluteUrl(path: string): string {
    try {
      return new URL(path, this.document.location.origin).toString();
    } catch {
      return path;
    }
  }
}

/** JSON-LD schema.org/Product cho trang chi tiết sản phẩm (Google rich result: giá, tồn kho, sao). */
export function buildProductJsonLd(product: any, canonicalUrl: string): Record<string, unknown> {
  const price = Number(product?.price ?? 0);
  const rating = Number(product?.averageRating ?? product?.rating ?? 0);
  const reviewCount = Number(product?.reviewCount ?? 0);
  const images = (Array.isArray(product?.images) ? product.images : [product?.image]).filter(Boolean);

  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product?.name,
    image: images,
    description: String(product?.description ?? '').replace(/\s+/g, ' ').trim().slice(0, 500) || undefined,
    sku: product?.productCode || product?.id,
    category: product?.categoryName || undefined,
    brand: { '@type': 'Brand', name: SITE_NAME },
    offers: {
      '@type': 'Offer',
      url: canonicalUrl,
      priceCurrency: 'VND',
      price: price > 0 ? price : undefined,
      availability: product?.outOfStock ? 'https://schema.org/OutOfStock' : 'https://schema.org/InStock',
    },
    ...(reviewCount > 0 && rating > 0
      ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: rating, reviewCount } }
      : {}),
  };
}
