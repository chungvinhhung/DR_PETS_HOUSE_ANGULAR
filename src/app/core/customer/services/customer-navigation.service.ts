import { computed, inject, Injectable, signal } from '@angular/core';
import { NavigationEnd, Params, Router } from '@angular/router';
import { filter } from 'rxjs';

export interface CustomerLocation {
  pathname: string;
  search: string;
  hash: string;
  /** Dữ liệu truyền kèm khi điều hướng (giống location.state của react-router). */
  state: any;
}

export interface CustomerNavigateOptions {
  replace?: boolean;
  state?: Record<string, unknown>;
}

/**
 * Gom các hook điều hướng của react-router vào 1 service dùng chung:
 *
 * | React (react-router-dom)              | Angular (service này)                         |
 * |---------------------------------------|-----------------------------------------------|
 * | const navigate = useNavigate()        | navService.navigate('/duong-dan')             |
 * | navigate(-1)                          | navService.navigate(-1)                       |
 * | const location = useLocation()        | navService.location().pathname / .search      |
 * | const { id } = useParams()            | navService.params()['id']                     |
 * | const [sp, setSp] = useSearchParams() | navService.searchParams().get('q') / setSearchParams(...) |
 *
 * Tất cả đều là signal nên template/computed tự cập nhật khi URL đổi.
 */
@Injectable({ providedIn: 'root' })
export class CustomerNavigationService {
  private readonly router = inject(Router);
  private readonly url = signal(this.router.url);

  constructor() {
    this.router.events.pipe(filter((event) => event instanceof NavigationEnd)).subscribe(() => {
      this.url.set(this.router.url);
    });
  }

  readonly location = computed<CustomerLocation>(() => {
    const url = this.url();
    const hashIndex = url.indexOf('#');
    const hash = hashIndex >= 0 ? url.slice(hashIndex) : '';
    const withoutHash = hashIndex >= 0 ? url.slice(0, hashIndex) : url;
    const queryIndex = withoutHash.indexOf('?');
    return {
      pathname: decodeURI(queryIndex >= 0 ? withoutHash.slice(0, queryIndex) : withoutHash) || '/',
      search: queryIndex >= 0 ? withoutHash.slice(queryIndex) : '',
      hash,
      state: typeof history !== 'undefined' ? history.state ?? null : null,
    };
  });

  /** Tham số động trên route hiện tại, vd. /thu-cung-cua-toi/:id -> params()['id'] */
  readonly params = computed<any>(() => {
    this.url();
    let snapshot = this.router.routerState.snapshot.root;
    const params: Params = { ...snapshot.params };
    while (snapshot.firstChild) {
      snapshot = snapshot.firstChild;
      Object.assign(params, snapshot.params);
    }
    return params;
  });

  /** Giống URLSearchParams của react-router: searchParams().get('q') */
  readonly searchParams = computed(() => new URLSearchParams(this.location().search));

  readonly navigate = (to: string | number, options: CustomerNavigateOptions = {}): void => {
    if (typeof to === 'number') {
      history.go(to);
      return;
    }
    void this.router.navigateByUrl(to, { replaceUrl: options.replace, state: options.state });
  }

  /**
   * Giống setSearchParams của react-router.
   * Nhận URLSearchParams, object {key: value} hoặc hàm (prev) => next.
   */
  readonly setSearchParams = (
    next: URLSearchParams | Record<string, any> | ((prev: URLSearchParams) => URLSearchParams | Record<string, any>),
    options: CustomerNavigateOptions = {},
  ): void => {
    const resolved = typeof next === 'function' ? next(new URLSearchParams(this.location().search)) : next;
    const params = resolved instanceof URLSearchParams ? resolved : new URLSearchParams();
    if (!(resolved instanceof URLSearchParams)) {
      for (const [key, value] of Object.entries(resolved ?? {})) {
        if (value === undefined || value === null) continue;
        params.set(key, String(value));
      }
    }
    const query = params.toString();
    this.navigate(this.location().pathname + (query ? `?${query}` : ''), options);
  }
}
