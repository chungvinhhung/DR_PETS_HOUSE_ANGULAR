import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminBreadcrumbComponent } from '../../../../shared/admin-breadcrumb/admin-breadcrumb.component';
import { AdminDataStateComponent } from '../../../../shared/admin-data-state/admin-data-state.component';
import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { AdminToastService, adminErrorMessage } from '../../../../shared/services/admin-toast.service';
import { AdminProductService } from '../../products/services/admin-product.service';
import { AdminProduct, ProductVariant } from '../../products/models/admin-product.model';
import {
  AdminFlashSale, AdminFlashSaleApiService, FlashSaleItemWrite, FlashSaleWriteBody,
  flashSaleState, flashSaleDate, flashSaleMoney, FLASH_SALE_STATE_LABELS,
} from '../services/admin-flash-sale-api.service';

interface DraftProduct {
  productId: string;
  variantId: string;
  sku: string;
  productName: string;
  variantName: string;
  imageUrl: string;
  originalPrice: number;
  salePrice: string;
  quantityLimit: string;
  soldQuantity: number;
}
interface SaleForm {
  name: string;
  description: string;
  from: string;
  to: string;
  items: DraftProduct[];
}
interface ProductOption {
  key: string;
  productId: string;
  variantId: string;
  productName: string;
  variantName: string;
  imageUrl: string;
  sku: string;
  price: number;
}

const EMPTY_FORM: SaleForm = {name:'', description:'', from:'', to:'', items:[]};

/** Input datetime-local intentionally represents Asia/Ho_Chi_Minh, not client device timezone. */
function vietnamLocal(iso: string): string {
  const millis = Date.parse(iso);
  if (!Number.isFinite(millis)) return '';
  return new Date(millis + 7 * 60 * 60000).toISOString().slice(0, 16);
}
function utcFromVietnam(value: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value)) return null;
  const date = new Date(value + ':00+07:00');
  return Number.isFinite(date.getTime()) ? date.toISOString() : null;
}

@Component({
  selector: 'app-admin-flash-sale-editor',
  standalone: true,
  imports: [RouterLink, AdminCatalogShellComponent, AdminBreadcrumbComponent, AdminDataStateComponent],
  templateUrl: './admin-flash-sale-editor.component.html',
  styleUrl: './admin-flash-sale-editor.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminFlashSaleEditorComponent {
  private readonly api = inject(AdminFlashSaleApiService);
  private readonly productsApi = inject(AdminProductService);
  private readonly session = inject(AuthSessionService);
  private readonly toast = inject(AdminToastService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly mode = this.route.snapshot.data['mode'] as 'create' | 'edit' | 'view';
  readonly id = this.route.snapshot.paramMap.get('id') ?? '';
  readonly original = signal<AdminFlashSale | null>(null);
  readonly form = signal<SaleForm>({...EMPTY_FORM, items:[]});
  readonly loading = signal(this.mode !== 'create');
  readonly saving = signal(false);
  readonly error = signal('');
  readonly validation = signal('');
  readonly dirty = signal(false);
  readonly canManage = computed(() => this.session.user()?.systemRole === 'ADMIN');
  readonly editable = computed(() => this.mode !== 'view' && this.canManage() && !this.saving());
  readonly currentState = computed(() => this.original() ? flashSaleState(this.original()!) : 'DRAFT');
  readonly stateLabels = FLASH_SALE_STATE_LABELS;

  readonly pickerOpen = signal(false);
  readonly pickerLoading = signal(false);
  readonly pickerError = signal('');
  readonly pickerSearch = signal('');
  readonly pickerOptions = signal<ProductOption[]>([]);
  readonly pickerSelected = signal<ProductOption[]>([]);
  readonly pickerNextCursor = signal<string | null>(null);
  readonly leaveOpen = signal(false);
  private leaveResolver: ((decision: boolean) => void) | null = null;
  private pickerRequest = 0;
  private pickerSearchTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly createKey = 'flash-create-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2);

  constructor() {
    this.destroyRef.onDestroy(() => {
      if (this.pickerSearchTimer) clearTimeout(this.pickerSearchTimer);
      this.leaveResolver?.(false);
      this.leaveResolver = null;
    });
    if (this.mode !== 'create') this.load();
  }

  private message(err: unknown, fallback: string): string {
    const status = err instanceof HttpErrorResponse ? err.status
      : (typeof err === 'object' && err && 'status' in err ? Number(err.status) : 0);
    if ([404,405,501].includes(status)) return 'BE chưa hỗ trợ chức năng quản lý Flash Sale trên môi trường này.';
    return adminErrorMessage(err, fallback);
  }

  load(): void {
    if (!this.id) return;
    this.loading.set(true);this.error.set('');
    this.api.get(this.id).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: sale => {
        this.original.set(sale);
        this.form.set({
          name:sale.name, description:sale.description,
          from:vietnamLocal(sale.startAt),to:vietnamLocal(sale.endAt),
          items:sale.items.map(x=>({
            productId:x.productId,variantId:x.variantId,sku:x.sku,
            productName:x.productName,variantName:x.variantName,
            imageUrl:x.imageUrl??'',originalPrice:x.originalPrice,
            salePrice:String(x.salePrice),quantityLimit:String(x.quantityLimit),
            soldQuantity:x.soldQuantity,
          })),
        });
        this.dirty.set(false);this.loading.set(false);
      },
      error: err=>{this.loading.set(false);this.error.set(this.message(err,'Không tải được Flash Sale.'));},
    });
  }
  update<K extends keyof Omit<SaleForm, 'items'>>(field: K, value: SaleForm[K]): void {
    if (!this.editable()) return;
    this.form.update(current=>({...current,[field]:value}));
    this.validation.set('');this.dirty.set(true);
  }
  updateItem(index: number, key: 'salePrice'|'quantityLimit', value: string): void {
    if (!this.editable()) return;
    this.form.update(f=>({...f,items:f.items.map((item,i)=>i===index?{...item,[key]:value}:item)}));
    this.validation.set('');this.dirty.set(true);
  }
  removeItem(index: number): void {
    if (!this.editable()) return;
    this.form.update(f=>({...f,items:f.items.filter((_,i)=>i!==index)}));
    this.dirty.set(true);
  }
  money(value: number): string {return flashSaleMoney(value);}
  date(value: string): string {return flashSaleDate(value);}

  private payload(): FlashSaleWriteBody | null {
    const f=this.form(),from=utcFromVietnam(f.from),to=utcFromVietnam(f.to);
    if (!f.name.trim() || f.name.trim().length>120) {
      this.validation.set('Vui lòng nhập tên chương trình (tối đa 120 ký tự).');return null;
    }
    if (!from || !to || Date.parse(to)<=Date.parse(from)) {
      this.validation.set('Vui lòng chọn thời gian kết thúc sau thời gian bắt đầu.');return null;
    }
    if (!f.items.length) {
      this.validation.set('Vui lòng thêm ít nhất một sản phẩm vào Flash Sale.');return null;
    }
    const items: FlashSaleItemWrite[]=[];
    for (const row of f.items) {
      const price=Number(row.salePrice),qty=Number(row.quantityLimit);
      if (!Number.isSafeInteger(price)||price<1||price>=row.originalPrice) {
        this.validation.set('Giá Flash Sale phải là số nguyên dương và thấp hơn giá hiện tại của từng SKU.');return null;
      }
      if (!Number.isSafeInteger(qty)||qty<1||qty<row.soldQuantity) {
        this.validation.set('Số lượng chương trình phải là số nguyên dương và không thấp hơn số đã bán.');return null;
      }
      items.push({productId:row.productId,variantId:row.variantId,salePrice:price,quantityLimit:qty});
    }
    return {name:f.name.trim(),description:f.description.trim(),startAt:from,endAt:to,items};
  }

  async save(publishAfterSave=false): Promise<void> {
    if (!this.editable() || this.saving()) return;
    const body=this.payload();if (!body) return;
    this.saving.set(true);this.validation.set('');
    try {
      const sale=this.mode==='create'
        ? await firstValueFrom(this.api.create(body,this.createKey))
        : await firstValueFrom(this.api.update(this.id,body));
      this.original.set(sale);this.dirty.set(false);
      if (publishAfterSave && sale.status==='DRAFT') {
        try {
          await firstValueFrom(this.api.publish(sale.id,'flash-publish-'+sale.id));
        }catch(err){
          this.toast.show('Đã lưu bản nháp nhưng chưa kích hoạt. '+this.message(err,'Vui lòng kích hoạt trong trang chi tiết.'),'error');
          await this.router.navigate(['/admin/flash-sales',sale.id]);return;
        }
      }
      this.toast.show(publishAfterSave?'Đã kích hoạt Flash Sale.':'Đã lưu Flash Sale.','success');
      await this.router.navigate(['/admin/flash-sales',sale.id]);
    }catch(err){
      this.validation.set(this.message(err,'Không thể lưu Flash Sale. Vui lòng thử lại.'));
    }finally{this.saving.set(false);}
  }

  async publish(): Promise<void> {
    if (!this.canManage()||this.saving()||!this.original()||this.original()!.status!=='DRAFT')return;
    this.saving.set(true);
    try{
      const updated=await firstValueFrom(this.api.publish(this.id,'flash-publish-'+this.id));
      this.original.set(updated);this.toast.show('Đã kích hoạt chương trình.','success');
    }catch(err){this.toast.show(this.message(err,'Không thể kích hoạt chương trình.'),'error');}
    finally{this.saving.set(false);}
  }

  async togglePaused(checked: boolean): Promise<void> {
    const sale=this.original();
    if (!this.canManage()||!sale||sale.status!=='PUBLISHED'||this.saving()||this.currentState()==='ENDED')return;
    this.saving.set(true);
    try{
      const updated=await firstValueFrom(this.api.setPaused(sale.id,checked));
      this.original.set(updated);
      this.toast.show(checked?'Đã tạm ngừng Flash Sale.':'Đã tiếp tục Flash Sale.','success');
    }catch(err){this.toast.show(this.message(err,'Không cập nhật được trạng thái chương trình.'),'error');}
    finally{this.saving.set(false);}
  }
  cancel(): void {void this.router.navigateByUrl(this.mode==='create'?'/admin/flash-sales':'/admin/flash-sales/'+this.id);}

  canLeavePage(): boolean | Promise<boolean> {
    if (this.saving()) return false;
    if (!this.dirty()) return true;
    if (this.leaveResolver) return false;
    this.leaveOpen.set(true);
    return new Promise<boolean>(resolve=>this.leaveResolver=resolve);
  }
  resolveLeave(decision: boolean): void {
    const resolve=this.leaveResolver;this.leaveResolver=null;this.leaveOpen.set(false);
    resolve?.(decision);
  }
  @HostListener('document:keydown.escape')
  closeByEscape(): void {
    if (this.leaveOpen()) this.resolveLeave(false);
    else if (this.pickerOpen()) this.closePicker();
  }

  openPicker(): void {
    if (!this.editable())return;
    this.pickerSelected.set([]);this.pickerSearch.set('');
    this.pickerOptions.set([]);this.pickerNextCursor.set(null);
    this.pickerOpen.set(true);this.loadProducts();
  }
  closePicker(): void {
    this.pickerOpen.set(false);++this.pickerRequest;this.pickerSelected.set([]);
    if(this.pickerSearchTimer)clearTimeout(this.pickerSearchTimer);
  }
  searchProducts(query: string): void {
    this.pickerSearch.set(query);
    if(this.pickerSearchTimer)clearTimeout(this.pickerSearchTimer);
    this.pickerSearchTimer=setTimeout(()=>{
      this.pickerNextCursor.set(null);this.pickerOptions.set([]);this.loadProducts();
    },300);
  }
  loadProducts(cursor: string|null=null): void {
    if (!this.pickerOpen())return;
    const request=++this.pickerRequest;
    this.pickerLoading.set(true);this.pickerError.set('');
    this.productsApi.listProducts({q:this.pickerSearch(),status:'ACTIVE',limit:20,
      ...(cursor?{cursor}:{}),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:page=>{
        if(request!==this.pickerRequest||!this.pickerOpen())return;
        const products=Array.isArray(page.items)?page.items:[];
        const options:ProductOption[]=products.filter(product=>
          product.status==='ACTIVE' && product.usageType!=='SERVICE_SUPPLY')
          .flatMap((product:AdminProduct)=>product.variants.filter(v=>v.status==='ACTIVE')
            .map((v:ProductVariant)=>this.toOption(product,v)));
        this.pickerOptions.update(old=>cursor?[...old,...options]:options);
        this.pickerNextCursor.set(page.nextCursor||null);
        this.pickerLoading.set(false);
      },
      error:err=>{
        if(request!==this.pickerRequest)return;
        this.pickerLoading.set(false);
        this.pickerError.set(adminErrorMessage(err,'Không tải được sản phẩm.'));
      },
    });
  }
  private toOption(p:AdminProduct,v:ProductVariant): ProductOption {
    const image=p.images?.find(img=>img.isPrimary)?.url??p.images?.[0]?.url??v.image??'';
    return {
      key:p.id+'::'+v.id,productId:p.id,variantId:v.id,
      productName:p.name,variantName:v.label,sku:v.sku,imageUrl:image??'',
      price:Number(v.finalPrice??v.price),
    };
  }
  isInForm(opt:ProductOption):boolean{
    return this.form().items.some(item=>item.productId===opt.productId&&item.variantId===opt.variantId);
  }
  isPending(opt:ProductOption):boolean{return this.pickerSelected().some(item=>item.key===opt.key);}
  chooseOption(opt:ProductOption,checked:boolean):void {
    if (this.isInForm(opt))return;
    this.pickerSelected.update(a=>checked?[...a,opt]:a.filter(item=>item.key!==opt.key));
  }
  applySelection():void {
    if(!this.editable())return;
    const picked=this.pickerSelected().filter(opt=>!this.isInForm(opt));
    this.form.update(f=>({
      ...f,items:[...f.items,...picked.map(opt=>({
        productId:opt.productId,variantId:opt.variantId,sku:opt.sku,
        productName:opt.productName,variantName:opt.variantName,imageUrl:opt.imageUrl,
        originalPrice:opt.price,salePrice:'',quantityLimit:'',soldQuantity:0,
      }))],
    }));
    if(picked.length){this.dirty.set(true);this.validation.set('');}
    this.closePicker();
  }
}
