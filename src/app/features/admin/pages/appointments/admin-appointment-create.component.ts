import { ChangeDetectionStrategy, Component, DestroyRef, HostListener, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminOrderCreateLookupService, OrderCustomerLookup } from '../../orders/services/admin-order-create-lookup.service';
import { ServiceCatalogApiService } from '../../service-catalog/services/service-catalog-api.service';
import { CatalogBranch, CatalogService } from '../../service-catalog/models/service-catalog.model';
import { AdminToastService, adminErrorMessage } from '../../../../shared/services/admin-toast.service';

interface PetDraft { id: string; name: string; species: string; }
type LookupState = 'idle'|'loading'|'found'|'not-found'|'error';
const normalizePhone=(raw:string)=>{const p=raw.replace(/\D/g,'');return p.startsWith('84')&&p.length>=11?'0'+p.slice(2):p;};

@Component({
 selector:'app-admin-appointment-create',
 standalone:true,
 imports:[RouterLink,AdminCatalogShellComponent],
 template:`
 <app-admin-catalog-shell activeItem="appointments"><main class="create-appointment">
 <nav class="breadcrumbs"><a routerLink="/admin/appointments">Lịch hẹn</a><span>›</span><strong>Tạo lịch hẹn</strong></nav>
 <header><h1>Tạo lịch hẹn</h1></header>
 <div class="notice" role="status">Chức năng tạo lịch hẹn hộ khách đang chờ xác nhận API Backend. Có thể tra cứu và điền bản nháp nhưng chưa thể gửi lịch hẹn thật.</div>
 <section class="panel"><h2>Tra cứu khách hàng</h2><label>Số điện thoại khách hàng <b>*</b></label>
 <div class="lookup-row"><input type="tel" placeholder="Nhập số điện thoại..." [value]="phone()" (input)="updatePhone($any($event.target).value)" (keydown.enter)="lookup()" />
 <button class="primary" type="button" [disabled]="lookupState()==='loading'" (click)="lookup()">{{lookupState()==='loading'?'Đang tra cứu...':'Tra cứu'}}</button></div>
 @if(lookupState()==='not-found'){<p class="helper">Không tìm thấy khách hàng có số điện thoại này. Có thể nhập thông tin khách vãng lai; chưa tạo tài khoản tự động.</p>}
 @if(lookupState()==='error'){<p class="helper error">Không xác minh được khách hàng. Vui lòng thử lại.</p>}
 @if(customer();as current){<div class="selected"><strong>{{current.fullName||current.phone}}</strong> · {{current.activationStatus==='ACTIVATED'?'Đã kích hoạt':current.activationStatus==='PENDING_ACTIVATION'?'Chờ kích hoạt':'Chưa có tài khoản'}}
 @if(current.accountStatus==='BLOCKED'){<p class="error">Tài khoản bị chặn — không thể tạo lịch.</p>}
 <button type="button" class="link" (click)="updatePhone('')">Đổi khách hàng</button></div>}
 </section>
 <section class="panel"><h2>Thông tin khách hàng</h2><div class="fields">
 <label>Họ và tên <b>*</b><input [value]="fullName()" (input)="fullName.set($any($event.target).value)" [readOnly]="!!customer()"/></label>
 <label>Số điện thoại <b>*</b><input type="tel" [value]="phone()" (input)="updatePhone($any($event.target).value)"/></label>
 <label>Email<input type="email" [value]="email()" (input)="email.set($any($event.target).value)" [readOnly]="!!customer()"/></label>
 </div></section>
 <section class="panel"><div class="section-header"><h2>Thú cưng trong lịch hẹn</h2><button type="button" class="secondary" (click)="addPet()">+ Thêm thú cưng</button></div>
 @if(pets().length===0){<p class="helper">Chưa chọn thú cưng. Cần xác nhận hồ sơ thú cưng qua Backend trước khi đặt lịch thật.</p>}
 @for(pet of pets();track pet.id){<div class="pet-row"><input aria-label="Tên thú cưng" placeholder="Tên thú cưng" [value]="pet.name" (input)="setPet(pet.id,'name',$any($event.target).value)"/>
 <select aria-label="Loài" [value]="pet.species" (change)="setPet(pet.id,'species',$any($event.target).value)"><option value="">Chọn loài</option><option value="DOG">Chó</option><option value="CAT">Mèo</option><option value="OTHER">Khác</option></select>
 <button class="secondary" type="button" (click)="removePet(pet.id)">Xóa</button></div>}
 </section>
 <section class="panel"><h2>Dịch vụ và lịch hẹn</h2>
 <div class="fields"><label>Chi nhánh <b>*</b><select [value]="branchId()" (change)="selectBranch($any($event.target).value)">
 <option value="">Chọn chi nhánh</option>@for(branch of branches();track branch.id){<option [value]="branch.id">{{branch.name}}</option>}</select></label>
 <label>Dịch vụ <b>*</b><select [value]="serviceId()" (change)="serviceId.set($any($event.target).value)">
 <option value="">Chọn dịch vụ</option>@for(service of services();track service.id){<option [value]="service.id">{{service.name}}</option>}</select></label>
 <label>Ngày hẹn <b>*</b><input type="date" [min]="today" [value]="date()" (input)="date.set($any($event.target).value)"/></label>
 <label>Giờ hẹn <b>*</b><input type="time" [value]="time()" (input)="time.set($any($event.target).value)"/></label></div>
 <p class="helper">Khung giờ và sức chứa đồng thời phải được Backend xác nhận theo chi nhánh, dịch vụ, nhân sự và những lịch đã đặt. Giờ nhập ở đây chưa được giữ chỗ.</p>
 @if(dataError()){<p class="helper error">{{dataError()}} <button type="button" class="link" (click)="loadCatalog()">Thử lại</button></p>}
 </section>
 <section class="panel"><h2>Thanh toán</h2><p class="helper">Tổng tiền, phương thức thanh toán, cọc 30% và voucher phải tính từ kết quả Booking API, không được tự suy ra từ giá catalog.</p>
 <label>Ghi chú lịch hẹn<textarea rows="3" placeholder="Nhập ghi chú (nếu có)" [value]="note()" (input)="note.set($any($event.target).value)"></textarea></label></section>
 <div class="footer"><button type="button" class="secondary" (click)="cancel()">Hủy bỏ</button><button type="button" class="primary" (click)="review()">Xác nhận lịch hẹn</button></div>
 @if(reviewErrors().length){<div class="panel error-box" role="alert"><strong>Chưa thể xác nhận lịch hẹn</strong>@for(error of reviewErrors();track error){<p>• {{error}}</p>}</div>}
 @if(showCancel()){<div class="overlay"><div class="dialog" role="dialog" aria-modal="true" aria-label="Hủy tạo lịch hẹn"><h2>Hủy tạo lịch hẹn?</h2><p>Dữ liệu chưa lưu sẽ bị mất.</p><div class="footer"><button type="button" class="secondary" (click)="showCancel.set(false)">Tiếp tục nhập</button><button type="button" class="primary" (click)="leave()">Hủy bỏ</button></div></div></div>}
 </main></app-admin-catalog-shell>`,
 styles:[`
 :host{display:block;color:#25324a}.create-appointment{padding:32px;max-width:1160px;margin:auto}.breadcrumbs{display:flex;gap:10px;color:#728096;font-size:13px;margin-bottom:12px}.breadcrumbs a{color:#64748b;text-decoration:none}.breadcrumbs strong{color:#25324a}h1{font-size:25px;margin:0 0 20px}h2{font-size:17px;margin:0 0 16px}.panel{border:1px solid #e1e7ef;background:#fff;border-radius:12px;padding:20px;margin-bottom:18px}.notice{border-radius:8px;background:#fff7e6;border:1px solid #f7db93;color:#86550b;padding:13px 16px;margin:0 0 18px;font-size:13px}.fields{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.fields label,.panel>label{display:flex;flex-direction:column;gap:8px;font-size:13px;font-weight:600}.panel b{color:#d33}.panel input,.panel select,.panel textarea{width:100%;min-width:0;box-sizing:border-box;border:1px solid #d6dfeb;border-radius:7px;padding:10px 12px;min-height:40px;font:inherit;font-weight:400;color:#334155;background:white}.panel textarea{resize:vertical}.lookup-row{display:flex;gap:10px;max-width:450px;margin-top:10px}.lookup-row input{flex:1}.primary,.secondary{padding:10px 16px;border-radius:7px;font-size:13px;white-space:nowrap;cursor:pointer;min-height:38px}.primary{background:#0d47a1;color:white;border:1px solid #0d47a1}.secondary{background:#fff;color:#0d47a1;border:1px solid #cad7e7}.section-header{display:flex;justify-content:space-between;align-items:center}.section-header h2{margin:0}.helper{color:#718096;font-size:13px;line-height:1.5}.error{color:#bd3d3d}.selected{border:1px solid #badac6;background:#f4faf6;padding:12px;margin-top:14px;border-radius:8px;font-size:13px}.link{color:#0d47a1;text-decoration:underline;border:0;background:none;cursor:pointer}.pet-row{display:flex;gap:12px;margin-top:12px}.pet-row input{flex:1}.pet-row select{max-width:160px}.footer{display:flex;justify-content:flex-end;gap:12px;margin:20px 0}.error-box{color:#b33}.overlay{position:fixed;inset:0;background:#17243b8c;display:grid;place-items:center;z-index:9999}.dialog{background:white;border-radius:12px;padding:24px;max-width:450px;width:90%}@media(max-width:800px){.create-appointment{padding:16px}.fields{grid-template-columns:1fr}.pet-row{flex-wrap:wrap}}
 `],
 changeDetection:ChangeDetectionStrategy.OnPush
})
export class AdminAppointmentCreateComponent{
 private readonly lookupApi=inject(AdminOrderCreateLookupService);
 private readonly catalog=inject(ServiceCatalogApiService);
 private readonly toast=inject(AdminToastService);
 private readonly router=inject(Router);
 private readonly destroyRef=inject(DestroyRef);
 private requestVersion=0;private petSequence=0;
 readonly today=new Date().toLocaleDateString('en-CA');
 readonly phone=signal('');readonly fullName=signal('');readonly email=signal('');
 readonly customer=signal<OrderCustomerLookup|null>(null);readonly lookupState=signal<LookupState>('idle');
 readonly pets=signal<PetDraft[]>([]);readonly branchId=signal('');readonly serviceId=signal('');
 readonly branches=signal<CatalogBranch[]>([]);readonly services=signal<CatalogService[]>([]);
 readonly date=signal('');readonly time=signal('');readonly note=signal('');
 readonly dataError=signal('');readonly reviewErrors=signal<string[]>([]);readonly showCancel=signal(false);
 readonly dirty=computed(()=>Boolean(this.phone()||this.fullName()||this.pets().length||this.branchId()||this.serviceId()||this.date()||this.time()||this.note()));
 constructor(){this.loadCatalog();}
 loadCatalog():void{this.dataError.set('');this.catalog.listBranches().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:x=>this.branches.set(x),error:e=>this.dataError.set(adminErrorMessage(e,'Không tải được chi nhánh.'))});}
 selectBranch(value:string):void{this.branchId.set(value);this.serviceId.set('');this.services.set([]);if(!value)return;
 this.catalog.list({search:'',branchId:value,mode:'BOOKABLE',status:'ACTIVE',page:1,pageSize:100}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:x=>this.services.set(x.items.filter(s=>s.bookingMode==='BOOKABLE'&&s.status==='ACTIVE')),error:e=>this.dataError.set(adminErrorMessage(e,'Không tải được dịch vụ.'))});}
 updatePhone(value:string):void{this.requestVersion++;this.phone.set(value);this.customer.set(null);this.lookupState.set('idle');this.fullName.set('');this.email.set('');this.pets.set([]);}
 lookup():void{const phone=normalizePhone(this.phone());if(phone.length<9||phone.length>15){this.toast.show('Vui lòng nhập số điện thoại hợp lệ.');return;}
 const version=++this.requestVersion;this.lookupState.set('loading');
 this.lookupApi.searchCustomers(phone).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({next:res=>{if(version!==this.requestVersion)return;const matches=res.items.filter(c=>normalizePhone(c.phone||'')===phone);if(!matches.length&&res.nextCursor){this.lookupState.set('error');return;}const customer=matches.length===1?matches[0]:null;this.customer.set(customer);this.lookupState.set(customer?'found':matches.length?'error':'not-found');if(customer){this.fullName.set(customer.fullName||'');this.email.set(customer.email||'');}},error:e=>{if(version!==this.requestVersion)return;this.lookupState.set('error');this.toast.show(adminErrorMessage(e,'Không tra cứu được khách hàng.'));}});}
 addPet():void{this.pets.update(x=>[...x,{id:String(++this.petSequence),name:'',species:''}]);}
 removePet(id:string):void{this.pets.update(x=>x.filter(p=>p.id!==id));}
 setPet(id:string,key:'name'|'species',value:string):void{this.pets.update(x=>x.map(p=>p.id===id?{...p,[key]:value}:p));}
 review():void{const errors:string[]=[];if(!this.fullName().trim())errors.push('Nhập họ tên khách hàng.');if(!['found','not-found'].includes(this.lookupState()))errors.push('Tra cứu khách hàng bằng số điện thoại trước.');if(this.customer()?.accountStatus==='BLOCKED')errors.push('Không thể đặt cho tài khoản bị chặn.');
 if(!this.pets().length||this.pets().some(p=>!p.name.trim()||!p.species))errors.push('Nhập đầy đủ thông tin thú cưng.');if(!this.branchId()||!this.serviceId())errors.push('Chọn chi nhánh và dịch vụ.');if(!this.date()||!this.time())errors.push('Chọn ngày và giờ hẹn.');else if(new Date(this.date()+'T'+this.time()).getTime()<=Date.now())errors.push('Ngày giờ hẹn phải ở tương lai.');
 errors.push('Backend chưa xác nhận API tạo lịch hẹn hộ, kiểm tra slot, hồ sơ thú cưng và thanh toán. Chưa thể lưu lịch hẹn thật.');this.reviewErrors.set(errors);}
 cancel():void{if(this.dirty())this.showCancel.set(true);else this.leave();}
 leave():void{this.showCancel.set(false);void this.router.navigateByUrl('/admin/appointments');}
 canLeavePage():boolean|Promise<boolean>{if(!this.dirty())return true;return window.confirm('Bạn có thay đổi chưa lưu. Rời trang và bỏ dữ liệu?');}
 @HostListener('window:beforeunload',['$event']) preventUnload(event:BeforeUnloadEvent):void{if(this.dirty()){event.preventDefault();event.returnValue='';}}
}
