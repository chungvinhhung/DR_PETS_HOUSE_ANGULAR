import { firstValueFrom, Observable, timeout } from 'rxjs';

/** One rule for all back-office management tables. */
export const ADMIN_TABLE_PAGE_SIZE = 6;

interface CursorPage<T> {
  items: readonly T[];
  nextCursor: string | null;
}

/**
 * Fallback for older cursor APIs that omit totalItems.
 *
 * Prefer the exact total returned by the backend whenever available.
 * This walks at most 20 larger pages to avoid unbounded requests; when the
 * collection is too big or a request fails, callers display an unknown total
 * rather than guessing from the current page size.
 */
export async function countCursorItems<T>(
  fetchPage: (cursor: string | null) => Observable<CursorPage<T>>,
  include: (item: T) => boolean = () => true,
): Promise<number | null> {
  let cursor: string | null = null;
  let count = 0;
  const seen = new Set<string>();

  try {
    for (let i = 0; i < 20; i++) {
      const page: CursorPage<T> = await firstValueFrom(
        fetchPage(cursor).pipe(timeout({ first: 15000 })),
      );
      count += page.items.filter(include).length;

      if (!page.nextCursor) return count;
      if (seen.has(page.nextCursor)) return null;

      seen.add(page.nextCursor);
      cursor = page.nextCursor;
    }
  } catch {
    // The count is optional; never invent a total from a partial result.
  }

  return null;
}

/**
 * Shared numbered pagination for all Web 2 management tables.
 *
 * Always include both first and last page; show nearby pages and decorative
 * ellipses for skipped ranges. At most seven items, including ellipses:
 * 19 pages: at 1  => [1,2,3,4,5,'…',19]
 *           at 10 => [1,'…',9,10,11,'…',19]
 *           at 19 => [1,'…',15,16,17,18,19]
 *
 * This is display logic only; each module retains its own data-loading method.
 * The ellipsis is not a navigable page.
 */
export type AdminPageItem = number | '…';

export function adminPageWindow(current: number, total: number): AdminPageItem[] {
  const count = Math.max(1, Math.floor(total));
  const page = Math.min(count, Math.max(1, Math.floor(current)));
  if (count <= 7) return Array.from({ length: count }, (_, i) => i + 1);
  if (page <= 4) return [1, 2, 3, 4, 5, '…', count];
  if (page >= count - 3) return [1, '…', count - 4, count - 3, count - 2, count - 1, count];
  return [1, '…', page - 1, page, page + 1, '…', count];
}

/** Backward-compatible helper from Product pagination, now shared by all lists. */
export function adminPageWindowWithEdges(current: number, total: number): AdminPageItem[] {
  return adminPageWindow(current, total);
}
