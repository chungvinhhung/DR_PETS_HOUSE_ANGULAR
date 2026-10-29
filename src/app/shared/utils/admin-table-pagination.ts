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
 * Common visible pagination model. Show at most five numbered buttons.
 * Example (6 pages): page 1 -> [1,2,3,'…',6],
 * page 2 -> [2,3,4,'…',6]. Near the last page, show the final window.
 * The ellipsis is an indicator, not a navigable page.
 */
export type AdminPageItem = number | '…';
export function adminPageWindow(current: number, total: number): AdminPageItem[] {
  const count = Math.max(1, Math.floor(total));
  const page = Math.min(count, Math.max(1, Math.floor(current)));
  if (count <= 5) return Array.from({length:count}, (_,i)=>i+1);
  // Insert ellipsis only when at least one page is actually omitted.
  if (page+3 < count) return [page,page+1,page+2,'…',count];
  const start = Math.max(1,count-4);
  return Array.from({length:count-start+1},(_,i)=>start+i);
}
