import { adminPageWindowWithEdges } from '../../../../../shared/utils/admin-table-pagination';
import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, inject, OnInit, signal, effect } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, firstValueFrom, timeout } from 'rxjs';

import { AdminCatalogShellComponent } from '../../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminDataStateComponent } from "../../../../../shared/admin-data-state/admin-data-state.component";
import { AdminCategoryService } from '../../../categories/services/admin-category.service';
import { AdminCategory } from '../../../categories/models/admin-category.model';
import { AdminProductService } from '../../services/admin-product.service';
import { AdminProduct, ProductQuery, ProductSort, ProductStatus, ProductUsageType } from '../../models/admin-product.model';
import { ADMIN_TABLE_PAGE_SIZE } from '../../../../../shared/utils/admin-table-pagination';
import { AdminToastService, adminErrorMessage } from '../../../../../shared/services/admin-toast.service';

@Component({
  selector: 'app-admin-product-list-page',
  standalone: true,
  imports: [FormsModule, RouterLink, AdminCatalogShellComponent, AdminDataStateComponent],
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
  private readonly showDeleteErrors = effect(() => { if (this.deleteError()) this.toast.show(this.deleteError()); });
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
  readonly deleteTarget = signal<AdminProduct | null>(null);
  readonly deleteError = signal('');
  readonly archiveMenuProduct = signal<AdminProduct | null>(null);
  readonly archiveMenuPosition = signal({ top: 0, left: 0 });
  private readonly deleteKeys = new Map<string, string>();
  private readonly archiveKeys = new Map<string, string>();
  readonly pageNumber = signal(1);
  readonly hasNextPage = signal(false);
  readonly totalProducts = signal<number | null>(null);
  readonly countUnavailable = signal(false);
  readonly failedPage = signal<number | null>(null);

  searchTerm = '';
  // Draft selections live in the popovers; the applied snapshot drives every API request.
  categoryFilters: string[] = [];
  usageFilters: ProductUsageType[] = [];
  priceFilters: Array<'LOW'|'MID'|'HIGH'> = [];
  statusFilter: 'ALL' | 'ACTIVE' | 'INACTIVE' = 'ALL';
  daysFilter = 0;
  sort: ProductSort = 'NEWEST';
  archiveView = false;
  openPanel: 'category'|'more'|null = null;
  readonly activeChips = signal<Array<{group:'category'|'usage'|'price'|'status'|'days';label:string}>>([]);
  private appliedCategories: string[] = [];
  private appliedUsage: ProductUsageType[] = [];
  private appliedPrices: Array<'LOW'|'MID'|'HIGH'> = [];
  private appliedStatus: 'ALL' | 'ACTIVE' | 'INACTIVE' = 'ALL';
  private appliedDays = 0;
  private aggregateProducts: AdminProduct[] | null = null;
  private requestNumber = 0;

  ngOnInit(): void {
    this.archiveView = this.route.snapshot.queryParamMap.get('view') === 'archived';
    this.statusFilter = 'ALL';
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
    this.usageFilters = this.toggleArrayValue(this.usageFilters, value);
  }
  togglePrice(value: 'LOW'|'MID'|'HIGH'): void {
    this.priceFilters=this.toggleArrayValue(this.priceFilters,value);
  }
  toggleDays(value: number): void {
    this.daysFilter=this.daysFilter===value?0:value;
  }
  /** A normal single-select Status dropdown applies as soon as it changes. */
  setStatusFilter(value: 'ALL' | 'ACTIVE' | 'INACTIVE'): void {
    if (this.archiveView) return;
    this.copyAppliedToDraft();
    this.statusFilter = value;
    this.applyFilters();
  }
  /** Compact Status select in the advanced panel keeps its value as a draft. */
  setDraftStatusFilter(value: 'ALL' | 'ACTIVE' | 'INACTIVE'): void {
    this.statusFilter = value;
  }
  selectedStatus(): 'ALL' | 'ACTIVE' | 'INACTIVE' {
    return this.appliedStatus;
  }
  private toggleArrayValue<T>(values:T[],value:T):T[]{
    return values.includes(value)?values.filter(v=>v!==value):[...values,value];
  }
  private copyAppliedToDraft():void{
    this.categoryFilters=[...this.appliedCategories];
    this.usageFilters=[...this.appliedUsage];
    this.priceFilters=[...this.appliedPrices];
    this.statusFilter=this.appliedStatus;
    this.daysFilter=this.appliedDays;
  }
  togglePanel(panel:'category'|'more'):void{
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
      group==='status'?(this.appliedStatus === 'ALL' ? 0 : 1):
      this.appliedDays?1:0;
  }
  private updateFilterChips():void{
    const chips:Array<{group:'category'|'usage'|'price'|'status'|'days';label:string}>=[];
    if(this.appliedCategories.length)chips.push({group:'category',label:'Danh mục: '+this.appliedCategories.length});
    if(this.appliedStatus !== 'ALL')chips.push({group:'status',label:'Trạng thái: '+(this.appliedStatus==='ACTIVE'?'Đang hoạt động':'Tạm ngưng')});
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
    if(group==='status')this.statusFilter='ALL';
    if(group==='days')this.daysFilter=0;
    this.applyFilters();
  }
  clearAdvancedFilters():void{
    // On narrow screens the advanced panel also contains Category and Status.
    this.categoryFilters=[];
    this.statusFilter='ALL';
    this.usageFilters=[];
    this.priceFilters=[];
    this.daysFilter=0;
  }
  clearQuickFilter():void {
    this.categoryFilters=[];
  }
  clearFilters():void{
    this.categoryFilters=[];
    this.usageFilters=[];
    this.priceFilters=[];
    this.statusFilter='ALL';
    this.daysFilter=0;
    this.searchTerm='';
    this.sort='NEWEST';
    this.applyFilters();
  }
  applyFilters():void{
    this.closeArchiveMenu();
    this.appliedCategories=[...this.categoryFilters];
    this.appliedUsage=[...this.usageFilters];
    this.appliedPrices=[...this.priceFilters];
    this.appliedStatus=this.statusFilter;
    this.appliedDays=this.daysFilter;
    this.updateFilterChips();
    this.openPanel=null;
    this.aggregateProducts=null;
    // Invalidate any in-flight pagination request and reset the visible page.
    this.totalProducts.set(null);
    this.countUnavailable.set(false);
    this.failedPage.set(null);
    this.products.set([]);
    this.hasNextPage.set(false);
    this.pageNumber.set(1);
    this.loadPage(1);
  }
  selectArchiveView(archived:boolean):void{
    if(this.archiveView===archived)return;
    this.closeArchiveMenu();
    this.archiveView=archived;
    this.statusFilter='ALL';
    this.openPanel=null;
    this.applyFilters();
  }

  // BE accepts a single usageType. For two selected values, load the bounded
  // full result set and filter their union before presenting numbered pages.
  private needsAggregatedFiltering():boolean{
    return (this.appliedUsage.length===2) ||
      (this.appliedPrices.length===2 &&
        this.appliedPrices.includes('LOW') && this.appliedPrices.includes('HIGH'));
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
        this.appliedStatus==='ALL'?undefined:this.appliedStatus,
      sort:this.sort,
    };
  }
  private matchesExtraFilters(product:AdminProduct):boolean{
    if(this.appliedUsage.length===2 &&
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
      let added=0;
      for(const product of response.items){
        if(ids.has(product.id))continue;
        added++;
        ids.add(product.id);
        if(this.matchesExtraFilters(product))found.push(product);
      }
      // If an older BE ignores the page parameter it may repeat page 1.
      // Never claim that incomplete repeated rows form the entire result.
      if(response.items.length&&added===0&&count!==null&&ids.size<count)
        throw new Error('Chưa thể tải đầy đủ sản phẩm. Vui lòng thử lại sau.');
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
      this.failedPage.set(null);
    }).catch(error=>{
      if(serial!==this.requestNumber||this.destroyRef.destroyed)return;
      this.error.set(adminErrorMessage(error,'Không thể lọc sản phẩm. Vui lòng thử lại.'));
      this.failedPage.set(page);
    }).finally(()=>{
      if(serial===this.requestNumber&&!this.destroyRef.destroyed)this.loading.set(false);
    });
  }

  /**
   * Use the BE's native page/limit with its stable createdAt + _id sort.
   * An _id-only cursor does not preserve createdAt sort order and requires
   * walking through every prior page to jump to the final page.
   */
  loadPage(page: number): void {
    this.closeArchiveMenu();
    if (this.needsAggregatedFiltering()) { this.loadAggregatedPage(page); return; }
    if (!Number.isInteger(page) || page < 1) return;

    const serial = ++this.requestNumber;
    const query: ProductQuery = {
      ...this.buildQuery(), page, limit: this.pageSize, cursor: null,
    };
    this.loading.set(true);
    this.error.set('');
    this.failedPage.set(null);

    void firstValueFrom(this.productsApi.listProducts(query).pipe(
      timeout({ first: 30000 }),
      takeUntilDestroyed(this.destroyRef),
    )).then(result => {
      if (serial !== this.requestNumber || this.destroyRef.destroyed) return;

      // Never present page 1 as page N if a stale BE ignores page=.
      if (typeof result.page === 'number' && result.page !== page) {
        throw new Error('Backend trả về trang không đúng. Vui lòng kiểm tra hỗ trợ phân trang page/limit.');
      }
      const reported = result.totalItems ?? result.totalCount ?? result.total;
      const total = typeof reported === 'number' &&
        Number.isSafeInteger(reported) && reported >= 0 ? reported : null;

      // Records may have been archived/deleted in another session. Move to
      // the new final page instead of displaying an empty stale page.
      if (total !== null && page > Math.max(1, Math.ceil(total / this.pageSize))) {
        this.totalProducts.set(total);
        this.loadPage(Math.max(1, Math.ceil(total / this.pageSize)));
        return;
      }
      if (total !== null && result.items.length === 0 &&
          (page - 1) * this.pageSize < total) {
        throw new Error('Backend trả về trang trống dù vẫn còn sản phẩm.');
      }
      // The BE applies archived status filters before page/limit.
      if (result.items.some(product => this.archiveView
          ? product.status !== 'ARCHIVED' : product.status === 'ARCHIVED')) {
        throw new Error('Backend trả về sản phẩm không đúng trạng thái lọc.');
      }

      this.products.set(result.items);
      this.pageNumber.set(page);
      this.totalProducts.set(total);
      this.countUnavailable.set(total === null);
      this.hasNextPage.set(total !== null
        ? page * this.pageSize < total
        : !!result.nextCursor);
      this.failedPage.set(null);
    }).catch((error: unknown) => {
      if (serial !== this.requestNumber || this.destroyRef.destroyed) return;
      // Failed navigation never clears already loaded products or their
      // page/total; the retry button reloads the attempted page.
      this.error.set(adminErrorMessage(error, 'Không thể tải danh sách sản phẩm.'));
      this.failedPage.set(page);
    }).finally(() => {
      if (serial === this.requestNumber && !this.destroyRef.destroyed) {
        this.loading.set(false);
      }
    });
  }

  visiblePageNumbers() {
    const total = this.totalProducts();
    // Show page 1 and the last page even when the user is at the opposite end.
    // Only show validated page numbers from the backend's actual total.
    if (total === null) return [this.pageNumber()];
    return adminPageWindowWithEdges(this.pageNumber(), Math.max(1, Math.ceil(total / this.pageSize)));
  }

  goToPage(page: number): void {
    const total = this.totalProducts();
    if (!Number.isInteger(page) || page < 1 ||
        (total !== null && page > Math.max(1, Math.ceil(total / this.pageSize))) ||
        this.loading() || page === this.pageNumber()) return;
    this.loadPage(page);
  }

  previous(): void {
    if (!this.loading() && this.pageNumber() > 1) this.loadPage(this.pageNumber() - 1);
  }

  next(): void {
    if (!this.loading() && this.hasNextPage()) this.loadPage(this.pageNumber() + 1);
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
        this.toast.show('Đã cập nhật trạng thái sản phẩm.', 'success');
      },
      error: err => this.error.set(adminErrorMessage(err, 'Không thể cập nhật trạng thái sản phẩm.')),
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
          adminErrorMessage(error, 'Không thể lưu trữ sản phẩm. Vui lòng thử lại.'),
        );
      },
    });
  }

  toggleArchiveMenu(event: MouseEvent, product: AdminProduct): void {
    event.stopPropagation();
    if (!this.archiveView || product.status !== 'ARCHIVED' || this.updatingId()) return;
    if (this.archiveMenuProduct()?.id === product.id) { this.closeArchiveMenu(); return; }
    const button = event.currentTarget as HTMLElement;
    const rect = button.getBoundingClientRect();
    // Fixed positioning keeps the dropdown out of the horizontally scrolling
    // table's clipping container, including when the archived row is last.
    const width = 195;
    const height = 122;
    const gutter = 4;
    this.archiveMenuPosition.set({
      left: Math.max(8, Math.min(window.innerWidth - width - 8, rect.right - width)),
      top: rect.bottom + height + gutter <= window.innerHeight - 8
        ? rect.bottom + gutter : Math.max(8, rect.top - height - gutter),
    });
    this.archiveMenuProduct.set(product);
  }

  @HostListener('document:click')
  @HostListener('window:resize')
  @HostListener('window:scroll')
  closeArchiveMenu(): void { this.archiveMenuProduct.set(null); }

  @HostListener('document:keydown.escape')
  closeArchiveMenuOnEscape(): void { this.closeArchiveMenu(); }

  chooseArchiveAction(action: 'restore' | 'edit' | 'delete'): void {
    const product = this.archiveMenuProduct();
    this.closeArchiveMenu();
    if (!product || !this.archiveView || product.status !== 'ARCHIVED' || this.updatingId()) return;
    if (action === 'restore') { this.requestRestore(product); return; }
    if (action === 'delete') { this.requestDelete(product); return; }
    void this.router.navigate(['/admin/products', product.id, 'edit'], {
      queryParams: { view: 'archived' },
    });
  }

  requestDelete(product: AdminProduct): void {
    if (product.status !== 'ARCHIVED' || this.updatingId()) return;
    this.deleteError.set('');
    this.deleteTarget.set(product);
  }

  closeDeleteDialog(): void {
    if (this.updatingId()) return;
    this.deleteTarget.set(null);
    this.deleteError.set('');
  }

  confirmDelete(): void {
    const product = this.deleteTarget();
    if (!product || product.status !== 'ARCHIVED' || this.updatingId()) return;
    const key = this.deleteKeys.get(product.id) ?? crypto.randomUUID();
    this.deleteKeys.set(product.id, key);
    this.updatingId.set(product.id);
    this.deleteError.set('');
    this.productsApi.deleteProductPermanently(product.id, key).pipe(
      timeout({ first: 30000 }),
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.updatingId.set(null)),
    ).subscribe({
      next: () => {
        this.deleteKeys.delete(product.id);
        this.deleteTarget.set(null);
        this.toast.show('Đã xóa vĩnh viễn sản phẩm.', 'success');
        this.applyFilters();
      },
      error: (error: unknown) => {
        const status = (error as { status?: number } | null)?.status;
        if (status === 404 || status === 405 || status === 501) {
          this.deleteError.set(
            'Backend chưa hỗ trợ API xóa vĩnh viễn (DELETE /products/:id), hoặc sản phẩm không còn tồn tại. Không có thao tác xóa nào được xác nhận.',
          );
        } else if (status === 409 || status === 422) {
          this.deleteError.set(
            'Không thể xóa vĩnh viễn vì sản phẩm đang có dữ liệu liên quan. Vui lòng kiểm tra đơn hàng và tồn kho trước khi thử lại.',
          );
        } else {
          this.deleteError.set(adminErrorMessage(error, 'Không thể xóa vĩnh viễn sản phẩm.'));
        }
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
