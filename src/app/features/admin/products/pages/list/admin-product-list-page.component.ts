import { adminPageWindow } from '../../../../../shared/utils/admin-table-pagination';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, OnInit, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, firstValueFrom, timeout } from 'rxjs';

import { AdminCatalogShellComponent } from '../../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminCategoryService } from '../../../categories/services/admin-category.service';
import { AdminCategory } from '../../../categories/models/admin-category.model';
import { AdminProductService } from '../../services/admin-product.service';
import { AdminProduct, ProductQuery, ProductSort, ProductStatus, ProductUsageType } from '../../models/admin-product.model';
import { ADMIN_TABLE_PAGE_SIZE, countCursorItems } from '../../../../../shared/utils/admin-table-pagination';
import { AdminToastService, adminErrorMessage } from '../../../../../shared/services/admin-toast.service';

@Component({
  selector: 'app-admin-product-list-page',
  standalone: true,
  imports: [FormsModule, RouterLink, AdminCatalogShellComponent],
  templateUrl: './admin-product-list-page.component.html',
  styleUrl: './admin-product-list-page.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminProductListPageComponent implements OnInit {
  private readonly productsApi = inject(AdminProductService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly toast = inject(AdminToastService);
  private readonly showErrors = effect(() => { if (this.error()) this.toast.show(this.error()); });
  private readonly showArchiveErrors = effect(() => { if (this.archiveError()) this.toast.show(this.archiveError()); });
  private readonly showRestoreErrors = effect(() => { if (this.restoreError()) this.toast.show(this.restoreError()); });
  private readonly categoriesApi = inject(AdminCategoryService);
  private readonly destroyRef = inject(DestroyRef);

  readonly pageSize = ADMIN_TABLE_PAGE_SIZE;
  readonly products = signal<AdminProduct[]>([]);
  readonly categories = signal<AdminCategory[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly updatingId = signal<string | null>(null);
  readonly archiveTarget = signal<AdminProduct | null>(null);
  readonly archiveError = signal('');
  readonly restoreTarget = signal<AdminProduct | null>(null);
  readonly restoreError = signal('');
  private readonly archiveKeys = new Map<string, string>();
  readonly pageNumber = signal(1);
  readonly hasNextPage = signal(false);
  readonly totalProducts = signal<number | null>(null);
  readonly countingPages = signal(false);
  readonly countUnavailable = signal(false);

  searchTerm = '';
  // Draft selections live in the popovers; the applied snapshot drives every API request.
  categoryFilters: string[] = [];
  usageFilters: ProductUsageType[] = [];
  priceFilters: Array<'LOW'|'MID'|'HIGH'> = [];
  statusFilters: Array<'ACTIVE'|'INACTIVE'> = [];
  daysFilter = 0;
  sort: ProductSort = 'NEWEST';
  archiveView = false;
  openPanel: 'category'|'status'|'more'|null = null;
  readonly activeChips = signal<Array<{group:'category'|'usage'|'price'|'status'|'days';label:string}>>([]);
  private appliedCategories: string[] = [];
  private appliedUsage: ProductUsageType[] = [];
  private appliedPrices: Array<'LOW'|'MID'|'HIGH'> = [];
  private appliedStatuses: Array<'ACTIVE'|'INACTIVE'> = [];
  private appliedDays = 0;
  private aggregateProducts: AdminProduct[] | null = null;
  // Offset is within one BE cursor page, NOT a product variant index.
  // A BE page may contain archived products removed from the current tab,
  // so we resume at the exact raw product position after collecting 6 visible ones.
  private cursors: Array<{ cursor: string | null; offset: number }> = [
    { cursor: null, offset: 0 },
  ];
  private requestNumber = 0;
  private countGeneration = 0;
  private countRequested = false;

  ngOnInit(): void {
    this.archiveView = this.route.snapshot.queryParamMap.get('view') === 'archived';
    this.statusFilters = [];
    const navState = window.history.state as { productNotice?: unknown } | null;
    if (typeof navState?.productNotice === 'string') {
      this.toast.show(navState.productNotice, 'success');
      // Do not re-show the same success notice after a reload.
      const { productNotice: ignored, ...rest } = navState;
      window.history.replaceState(rest, '', window.location.href);
    }
    void this.loadCategories();
    this.loadPage(1);
    // A newly created/updated product may briefly be absent from BE read replicas.
    // Refresh once without showing a mock result or reusing the previous list.
    if (typeof navState?.productNotice === 'string') {
      setTimeout(() => {
        if (!this.destroyRef.destroyed && this.pageNumber() === 1 && !this.archiveView &&
            !this.searchTerm && !this.categoryFilters.length) this.applyFilters();
      }, 900);
    }
  }

  private async loadCategories(): Promise<void> {
    try {
      const result = await firstValueFrom(this.categoriesApi.listCategories({ limit: 100 }));
      this.categories.set(result.items);
    } catch {
      // List remains usable with category IDs if metadata is temporarily unavailable.
    }
  }

  onSearchInput(value: string): void {
    this.searchTerm = value;
    if (!value.trim()) this.applyFilters();
  }

  toggleCategory(id: string): void {
    this.categoryFilters=this.toggleArrayValue(this.categoryFilters,id);
  }
  toggleUsage(value: ProductUsageType): void {
    this.usageFilters=this.toggleArrayValue(this.usageFilters,value);
  }
  togglePrice(value: 'LOW'|'MID'|'HIGH'): void {
    this.priceFilters=this.toggleArrayValue(this.priceFilters,value);
  }
  toggleDays(value: number): void {
    this.daysFilter=this.daysFilter===value?0:value;
  }
  toggleStatus(value: 'ACTIVE'|'INACTIVE'): void {
    this.statusFilters=this.toggleArrayValue(this.statusFilters,value);
  }
  private toggleArrayValue<T>(values:T[],value:T):T[]{
    return values.includes(value)?values.filter(v=>v!==value):[...values,value];
  }
  private copyAppliedToDraft():void{
    this.categoryFilters=[...this.appliedCategories];
    this.usageFilters=[...this.appliedUsage];
    this.priceFilters=[...this.appliedPrices];
    this.statusFilters=[...this.appliedStatuses];
    this.daysFilter=this.appliedDays;
  }
  togglePanel(panel:'category'|'status'|'more'):void{
    if(this.openPanel===panel){this.closePanel();return;}
    this.copyAppliedToDraft();
    this.openPanel=panel;
  }
  closePanel():void{
    this.openPanel=null;
    this.copyAppliedToDraft();
  }
  onFilterEscape():void{this.closePanel();}
  activeCount(group:'category'|'usage'|'price'|'status'|'days'):number{
    return group==='category'?this.appliedCategories.length:
      group==='usage'?this.appliedUsage.length:
      group==='price'?this.appliedPrices.length:
      group==='status'?this.appliedStatuses.length:
      this.appliedDays?1:0;
  }
  private updateFilterChips():void{
    const chips:Array<{group:'category'|'usage'|'price'|'status'|'days';label:string}>=[];
    if(this.appliedCategories.length)chips.push({group:'category',label:'Danh mục: '+this.appliedCategories.length});
    if(this.appliedStatuses.length)chips.push({group:'status',label:'Trạng thái: '+this.appliedStatuses.length});
    if(this.appliedUsage.length)chips.push({group:'usage',label:'Loại sử dụng: '+this.appliedUsage.length});
    if(this.appliedPrices.length)chips.push({group:'price',label:'Khoảng giá: '+this.appliedPrices.length});
    if(this.appliedDays)chips.push({group:'days',label:'Ngày tạo: '+this.appliedDays+' ngày'});
    this.activeChips.set(chips);
  }
  removeFilter(group:'category'|'usage'|'price'|'status'|'days'):void{
    this.copyAppliedToDraft();
    if(group==='category')this.categoryFilters=[];
    if(group==='usage')this.usageFilters=[];
    if(group==='price')this.priceFilters=[];
    if(group==='status')this.statusFilters=[];
    if(group==='days')this.daysFilter=0;
    this.applyFilters();
  }
  clearAdvancedFilters():void{
    this.usageFilters=[];
    this.priceFilters=[];
    this.daysFilter=0;
  }
  clearQuickFilter(group:'category'|'status'):void{
    if(group==='category')this.categoryFilters=[];
    else this.statusFilters=[];
  }
  clearFilters():void{
    this.categoryFilters=[];
    this.usageFilters=[];
    this.priceFilters=[];
    this.statusFilters=[];
    this.daysFilter=0;
    this.searchTerm='';
    this.sort='NEWEST';
    this.applyFilters();
  }
  applyFilters():void{
    this.appliedCategories=[...this.categoryFilters];
    this.appliedUsage=[...this.usageFilters];
    this.appliedPrices=[...this.priceFilters];
    this.appliedStatuses=[...this.statusFilters];
    this.appliedDays=this.daysFilter;
    this.updateFilterChips();
    this.openPanel=null;
    this.aggregateProducts=null;
    ++this.countGeneration;
    this.countRequested=false;
    this.totalProducts.set(null);
    this.countingPages.set(false);
    this.countUnavailable.set(false);
    this.cursors=[{cursor:null,offset:0}];
    this.hasNextPage.set(false);
    this.pageNumber.set(1);
    this.loadPage(1);
  }
  selectArchiveView(archived:boolean):void{
    if(this.archiveView===archived)return;
    this.archiveView=archived;
    this.statusFilters=[];
    this.openPanel=null;
    this.applyFilters();
  }

  // The current BE accepts multiple categoryIds separated by commas, but
  // usageType and price are singular. For non-contiguous OR selections,
  // read the complete bounded result set before applying client pagination.
  private needsAggregatedFiltering():boolean{
    return (this.appliedUsage.length>1&&this.appliedUsage.length<3) ||
      (this.appliedPrices.length===2&&
       this.appliedPrices.includes('LOW')&&this.appliedPrices.includes('HIGH'));
  }
  private priceBounds():{minPrice?:number;maxPrice?:number}{
    const bands=this.appliedPrices;
    if(!bands.length||bands.length===3)return {};
    if(bands.length===1){
      if(bands[0]==='LOW')return {maxPrice:99999};
      if(bands[0]==='MID')return {minPrice:100000,maxPrice:500000};
      return {minPrice:500001};
    }
    if(bands.includes('LOW')&&bands.includes('MID'))return {maxPrice:500000};
    if(bands.includes('MID')&&bands.includes('HIGH'))return {minPrice:100000};
    return {};
  }
  private buildQuery():ProductQuery{
    return {
      limit:20,
      q:this.searchTerm.trim()||undefined,
      categoryId:this.appliedCategories.join(',')||undefined,
      usageType:this.appliedUsage.length===1?this.appliedUsage[0]:undefined,
      createdWithinDays:this.appliedDays||undefined,
      ...this.priceBounds(),
      status:this.archiveView?'ARCHIVED':
        this.appliedStatuses.length===1?this.appliedStatuses[0]:undefined,
      sort:this.sort,
    };
  }
  private matchesExtraFilters(product:AdminProduct):boolean{
    if(this.appliedUsage.length>1&&this.appliedUsage.length<3 &&
       !this.appliedUsage.includes(product.usageType))return false;
    if(this.appliedPrices.length===2&&this.appliedPrices.includes('LOW')&&this.appliedPrices.includes('HIGH')){
      return product.variants.some(v=>{
        const price=Number(v.price);
        return Number.isFinite(price)&&(price<100000||price>500000);
      });
    }
    return true;
  }
  private async fetchAggregatedProducts(query:ProductQuery, serial:number):Promise<AdminProduct[]>{
    const found:AdminProduct[]=[];
    const ids=new Set<string>();
    // Refuse to show a partial result if the server set exceeds the safe cap.
    const MAX_PAGES=50;
    const pageSize=100;
    let count:number|null=null;
    for(let page=1;page<=MAX_PAGES;page++){
      const response=await firstValueFrom(this.productsApi.listProducts({
        ...query,limit:pageSize,page,cursor:null,
      }).pipe(timeout({first:30000}),takeUntilDestroyed(this.destroyRef)));
      if(serial!==this.requestNumber||this.destroyRef.destroyed)throw new Error('Đã thay đổi bộ lọc.');
      if(count===null){
        const n=response.totalItems??response.totalCount??response.total;
        if(typeof n==='number'&&Number.isSafeInteger(n)&&n>=0){
          count=n;
          if(n>MAX_PAGES*pageSize)throw new Error('Có quá nhiều sản phẩm. Vui lòng thu hẹp bộ lọc.');
        }
      }
      for(const product of response.items){
        if(ids.has(product.id))continue;
        ids.add(product.id);
        if(this.matchesExtraFilters(product))found.push(product);
      }
      if(!response.items.length ||
         (count!==null && page*pageSize>=count) ||
         (count===null && response.items.length<pageSize))return found;
      if(page===MAX_PAGES)throw new Error('Có quá nhiều sản phẩm. Vui lòng thu hẹp bộ lọc.');
    }
    return found;
  }
  private loadAggregatedPage(page:number):void{
    const serial=++this.requestNumber;
    this.loading.set(true);this.error.set('');
    const obtain=this.aggregateProducts?Promise.resolve(this.aggregateProducts):
      this.fetchAggregatedProducts(this.buildQuery(),serial);
    void obtain.then(items=>{
      if(serial!==this.requestNumber||this.destroyRef.destroyed)return;
      this.aggregateProducts=items;
      this.totalProducts.set(items.length);
      this.products.set(items.slice((page-1)*this.pageSize,page*this.pageSize));
      this.pageNumber.set(page);
      this.hasNextPage.set(page*this.pageSize<items.length);
    }).catch(error=>{
      if(serial!==this.requestNumber||this.destroyRef.destroyed)return;
      this.products.set([]);this.totalProducts.set(null);
      this.error.set(adminErrorMessage(error,'Không thể lọc sản phẩm. Vui lòng thử lại.'));
    }).finally(()=>{
      if(serial===this.requestNumber&&!this.destroyRef.destroyed)this.loading.set(false);
    });
  }

  loadPage(page: number): void {
    if(this.needsAggregatedFiltering()){this.loadAggregatedPage(page);return;}
    const position = this.cursors[page - 1];
    if (page < 1 || !position) return;

    const serial = ++this.requestNumber;
    this.loading.set(true);
    this.error.set('');

    const query=this.buildQuery();

    void this.loadVisibleProductPage(query, position)
      .then(({ items, nextPosition, apiTotal }) => {
        if (serial !== this.requestNumber || this.destroyRef.destroyed) return;
        this.products.set(items);
        this.pageNumber.set(page);
        this.hasNextPage.set(nextPosition !== null);
        this.cursors = this.cursors.slice(0, page);
        if (nextPosition) this.cursors[page] = nextPosition;

        // Foundation-v6 BE /products defaults to excluding ARCHIVED for staff,
        // and explicitly filters ARCHIVED on the archive tab. Its totalItems
        // already counts parent Products (not variants), matching this view.
        // Previous code discarded this valid count on the standard tab, causing
        // a permanent "unknown pages" footer even when the server returned totals.
        if (typeof apiTotal === 'number' && Number.isSafeInteger(apiTotal) &&
            apiTotal >= (page - 1) * this.pageSize + items.length) {
          this.totalProducts.set(apiTotal);
        } else if (!nextPosition) {
          this.totalProducts.set((page - 1) * this.pageSize + items.length);
        } else {
          this.countDisplayedProducts(query);
        }
      })
      .catch((error: unknown) => {
        if (serial !== this.requestNumber || this.destroyRef.destroyed) return;
        this.error.set(adminErrorMessage(error, 'Không thể tải danh sách sản phẩm.'));
        this.products.set([]);
        this.hasNextPage.set(false);
      })
      .finally(() => {
        if (serial === this.requestNumber && !this.destroyRef.destroyed) {
          this.loading.set(false);
        }
      });
  }

  /**
   * Cursor points to the NEXT backend chunk, not to the next visible Product.
   * Look ahead for a seventh non-archived Product so that Next is only enabled
   * if the following UI page has an actual parent record.
   */
  private async loadVisibleProductPage(
    query: ProductQuery,
    initial: { cursor: string | null; offset: number },
  ): Promise<{
    items: AdminProduct[];
    nextPosition: { cursor: string | null; offset: number } | null;
    apiTotal: number | null;
  }> {
    const items: AdminProduct[] = [];
    const knownCursors = new Set<string>();
    let cursor = initial.cursor;
    let offset = initial.offset;
    let apiTotal: number | null = null;

    // Guard against an invalid cursor loop; never silently misreport the count.
    for (let chunk = 0; chunk < 100; chunk++) {
      if (cursor !== null) {
        if (knownCursors.has(cursor)) throw new Error('Backend trả về cursor phân trang lặp.');
        knownCursors.add(cursor);
      }
      const result = await firstValueFrom(
        this.productsApi.listProducts({ ...query, cursor }).pipe(
          timeout({ first: 30000 }),
          takeUntilDestroyed(this.destroyRef),
        ),
      );

      if (apiTotal === null) {
        const reported = result.totalItems ?? result.totalCount ?? result.total;
        if (typeof reported === 'number' && Number.isSafeInteger(reported) && reported >= 0) {
          apiTotal = reported;
        }
      }

      // Every item is one Product Master (variants are nested inside it).
      for (let index = offset; index < result.items.length; index++) {
        const product = result.items[index];
        const visible = this.archiveView
          ? product.status === 'ARCHIVED'
          : product.status !== 'ARCHIVED';
        if (!visible) continue;

        if (items.length === this.pageSize) {
          return { items, nextPosition: { cursor, offset: index }, apiTotal };
        }
        items.push(product);
      }

      if (!result.nextCursor) {
        return { items, nextPosition: null, apiTotal };
      }
      cursor = result.nextCursor;
      offset = 0;
    }
    throw new Error('Danh sách quá dài để phân trang tại giao diện. Vui lòng thu hẹp bộ lọc.');
  }

  private countDisplayedProducts(query: ProductQuery): void {
    if (this.countRequested || this.totalProducts() !== null) return;
    this.countRequested = true;
    this.countingPages.set(true);
    this.countUnavailable.set(false);
    const generation = this.countGeneration;
    const archiveView = this.archiveView;

    // Source-verified BE catalog returns totalItems/totalCount/total for a
    // query independent of its cursor, as well as totalPages. Query just
    // one item first: this is much cheaper than counting enriched pages.
    const countQuery: ProductQuery = { ...query, cursor: null, limit: 1 };
    void firstValueFrom(this.productsApi.listProducts(countQuery).pipe(
      timeout({ first: 20000 }),
      takeUntilDestroyed(this.destroyRef),
    )).then(async result => {
      // This request uses limit=1, so BE totalPages equals the number of items.
      const rawCount = result.totalItems ?? result.totalCount ?? result.total ??
        result.totalPages;
      if (typeof rawCount === 'number' && Number.isSafeInteger(rawCount) && rawCount >= 0) {
        return rawCount;
      }
      // For older deployments without totalItems, exhaust cursor pages.
      // Use 20 rows/chunk to avoid long timeouts enriching 100 products at once.
      return countCursorItems(
        cursor => this.productsApi.listProducts({ ...query, cursor, limit: 20 }),
        (product: AdminProduct) => archiveView
          ? product.status === 'ARCHIVED' : product.status !== 'ARCHIVED',
      );
    }).catch(async () => {
      // The one-item count endpoint may be unavailable on an older backend;
      // continue with cursor counting rather than displaying guessed pages.
      return countCursorItems(
        cursor => this.productsApi.listProducts({ ...query, cursor, limit: 20 }),
        (product: AdminProduct) => archiveView
          ? product.status === 'ARCHIVED' : product.status !== 'ARCHIVED',
      );
    }).then(total => {
      if (generation !== this.countGeneration || this.destroyRef.destroyed) return;
      this.countingPages.set(false);
      if (total !== null) this.totalProducts.set(total);
      else this.countUnavailable.set(true);
    });
  }

  visiblePageNumbers() {
    const total = this.totalProducts();
    // Never fabricate an apparent total while the server-side count is unknown.
    // Numeric window is complete as soon as BE exposes an exact total or
    // the bounded full cursor count succeeds.
    if (total === null) return [this.pageNumber()];
    return adminPageWindow(this.pageNumber(), Math.max(1, Math.ceil(total / this.pageSize)));
  }

  async goToPage(page: number): Promise<void> {
    const total = this.totalProducts();
    if(this.needsAggregatedFiltering()){
      if(page>=1&&total!==null&&page<=Math.max(1,Math.ceil(total/this.pageSize)))
        this.loadAggregatedPage(page);
      return;
    }
    if (!Number.isInteger(page) || page < 1 ||
        (total !== null && page > Math.max(1, Math.ceil(total / this.pageSize))) ||
        this.loading() || page === this.pageNumber()) return;
    if (this.cursors[page - 1]) { this.loadPage(page); return; }
    // BE uses cursors rather than offsets; discover boundaries before jumping.
    const generation = this.requestNumber;
    const query=this.buildQuery();
    this.loading.set(true);
    try {
      while (this.cursors.length < page) {
        const position = this.cursors[this.cursors.length - 1];
        const result = await this.loadVisibleProductPage(query, position);
        if (generation !== this.requestNumber || this.destroyRef.destroyed) return;
        if (!result.nextPosition) return;
        this.cursors.push(result.nextPosition);
      }
    } catch (error) {
      if (generation === this.requestNumber && !this.destroyRef.destroyed)
        this.error.set(adminErrorMessage(error, 'Không thể chuyển đến trang này.'));
      return;
    } finally {
      if (generation === this.requestNumber && !this.destroyRef.destroyed) this.loading.set(false);
    }
    if (generation === this.requestNumber && !this.destroyRef.destroyed) this.loadPage(page);
  }

  previous(): void {
    if(this.pageNumber()>1)this.loadPage(this.pageNumber()-1);
  }

  next(): void {
    if(this.hasNextPage())this.loadPage(this.pageNumber()+1);
  }

  categoryName(id: string): string {
    return this.categories().find(item => item.id === id)?.name || '—';
  }

  productSku(product: AdminProduct): string {
    return product.variants.map(v => v.sku).join(', ') || '—';
  }

  priceRange(product: AdminProduct): string {
    // Keep Product List pricing consistent with Create/Edit and the payable price.
    const prices = product.variants
      .filter(v => Number.isFinite(Number(v.price)) && Number(v.price) >= 0)
      .map(v => {
        const discount = Math.min(100, Math.max(0, Number(v.discountPercent) || 0));
        return Math.round(Number(v.price) * (1 - discount / 100));
      });
    if (!prices.length) return '—';
    const min = Math.min(...prices), max = Math.max(...prices);
    const currency = (value: number) => value.toLocaleString('vi-VN') + 'đ';
    return min === max ? currency(min) : currency(min) + ' – ' + currency(max);
  }

  updateStatus(product: AdminProduct): void {
    if (product.status === 'ARCHIVED' || this.updatingId()) return;
    this.updatingId.set(product.id);
    this.error.set('');
    // OpenAPI v7 PATCH currently validates against ProductWrite, whose
    // required name/category/variants must be present even for status changes.
    this.productsApi.updateProduct(product.id, {
      name: product.name,
      description: product.description ?? '',
      categoryId: product.categoryId,
      variants: product.variants.map(v => ({
        id: v.id, label: v.label, sku: v.sku, price: v.price, status: v.status,
      })),
      status: product.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE',
    }).pipe(
      timeout({ first: 30000 }),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.updatingId.set(null)),
    ).subscribe({
      next: updated => {
        this.products.update(rows => rows.map(row => row.id === product.id ? updated : row));
      },
      error: err => this.error.set(err instanceof Error ? err.message : 'Không thể cập nhật trạng thái.'),
    });
  }

  requestArchive(product: AdminProduct): void {
    if (product.status === 'ARCHIVED' || this.updatingId()) return;
    this.archiveError.set('');
    this.archiveTarget.set(product);
  }

  closeArchiveDialog(): void {
    if (!this.updatingId()) this.archiveTarget.set(null);
  }

  confirmArchive(): void {
    const product = this.archiveTarget();
    if (!product || this.updatingId()) return;
    const key = this.archiveKeys.get(product.id) ?? crypto.randomUUID();
    this.archiveKeys.set(product.id, key);
    this.updatingId.set(product.id);
    this.archiveError.set('');
    this.productsApi.archiveProduct(product.id, key).pipe(
      timeout({ first: 30000 }),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.updatingId.set(null)),
    ).subscribe({
      next: () => {
        this.archiveKeys.delete(product.id);
        this.archiveTarget.set(null);
        this.toast.show('Đã lưu trữ sản phẩm thành công.', 'success');
        this.applyFilters();
      },
      error: error => {
        this.archiveError.set(
          adminErrorMessage(error, 'Không thể lưu trữ sản phẩm.') +
          ' Nếu kết quả chưa rõ, hãy kiểm tra tab Đã lưu trữ trước khi thử lại.',
        );
      },
    });
  }

  requestRestore(product: AdminProduct): void {
    if (product.status !== 'ARCHIVED' || this.updatingId()) return;
    this.restoreError.set('');
    this.restoreTarget.set(product);
  }

  closeRestoreDialog(): void {
    if (!this.updatingId()) this.restoreTarget.set(null);
  }

  confirmRestore(): void {
    const product = this.restoreTarget();
    if (!product || product.status !== 'ARCHIVED' || this.updatingId()) return;
    this.restoreError.set('');
    this.updatingId.set(product.id);
    this.productsApi.restoreProduct(product.id, crypto.randomUUID()).pipe(
      timeout({ first: 30000 }),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.updatingId.set(null)),
    ).subscribe({
      next: () => {
        this.restoreTarget.set(null);
        this.toast.show('Đã khôi phục sản phẩm thành công.', 'success');
        this.applyFilters();
      },
      error: (error: unknown) => {
        this.restoreError.set(
          adminErrorMessage(error, 'Không thể khôi phục sản phẩm.'),
        );
      },
    });
  }

  trackProduct(_index: number, item: AdminProduct): string { return item.id; }
}
