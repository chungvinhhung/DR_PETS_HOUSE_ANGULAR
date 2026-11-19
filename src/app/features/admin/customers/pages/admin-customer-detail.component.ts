import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, finalize, forkJoin, of } from 'rxjs';

import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { getPrimaryImage } from '../../../../core/customer/services/api/pet-api.service';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminBreadcrumbComponent } from '../../../../shared/admin-breadcrumb/admin-breadcrumb.component';
import { AdminDataStateComponent } from '../../../../shared/admin-data-state/admin-data-state.component';
import { AdminCustomer, AdminCustomerService } from '../services/admin-customer.service';
import { BranchManagementApiService } from '../../branch-management/services/branch-management-api.service';

@Component({
  selector:'app-admin-customer-detail',
  standalone:true,
  imports:[CommonModule,FormsModule,RouterLink,AdminCatalogShellComponent,AdminBreadcrumbComponent,AdminDataStateComponent],
  templateUrl:'./admin-customer-detail.component.html',
  styleUrl:'./admin-customer-detail.component.scss',
  changeDetection:ChangeDetectionStrategy.OnPush,
})
export class AdminCustomerDetailComponent {
  private readonly route=inject(ActivatedRoute);
  private readonly service=inject(AdminCustomerService);
  private readonly branchApi=inject(BranchManagementApiService);
  private readonly auth=inject(AuthSessionService);
  readonly customer=signal<AdminCustomer|null>(null);
  readonly pets=signal<any[]>([]);
  readonly orders=signal<any[]>([]);
  readonly appointments=signal<any[]>([]);
  readonly branchNames=signal<ReadonlyMap<string,string>>(new Map());
  readonly feedback=signal<any[]>([]);
  readonly loading=signal(true);
  readonly error=signal('');
  readonly dialog=signal<'block'|'unblock'|null>(null);
  readonly reason=signal('');
  readonly busy=signal(false);
  readonly actionError=signal('');
  readonly isAdmin=()=>this.auth.user()?.systemRole==='ADMIN';
  readonly id=this.route.snapshot.paramMap.get('id')||'';

  ngOnInit():void{this.load();}
  load():void{
    if(!this.id)return;
    this.loading.set(true);this.error.set('');
    forkJoin({
      detail:this.service.loadCustomerDetail(this.id),
      branches:this.branchApi.listBranches().pipe(catchError(()=>of([]))),
    }).pipe(finalize(()=>this.loading.set(false))).subscribe({
      next:({detail:data,branches})=>{
        this.branchNames.set(new Map(branches.filter(b=>b.id && b.name).map(b=>[b.id,b.name])));
        this.customer.set(data.customer);this.pets.set(data.pets);this.orders.set(data.orders);this.appointments.set(data.appointments);this.feedback.set(data.feedback);
      },
      error:()=>this.error.set('Không thể tải chi tiết khách hàng.'),
    });
  }
  openAction(mode:'block'|'unblock'):void{this.dialog.set(mode);this.reason.set('');this.actionError.set('');}
  closeAction():void{if(!this.busy())this.dialog.set(null);}
  submitAction():void{
    const customer=this.customer(), reason=this.reason().trim(), mode=this.dialog();
    if(!customer||!mode)return;
    if(reason.length<3){this.actionError.set('Vui lòng nhập lý do ít nhất 3 ký tự.');return;}
    this.busy.set(true);this.actionError.set('');
    const request=mode==='block'?this.service.block(customer.id,reason):this.service.unblock(customer.id,reason);
    request.pipe(finalize(()=>this.busy.set(false))).subscribe({
      next:value=>{this.customer.set(value);this.dialog.set(null);},
      error:()=>this.actionError.set('Không thể cập nhật trạng thái tài khoản. Vui lòng thử lại.'),
    });
  }
  activationLabel(v:string):string{return ({ACTIVATED:'Đã kích hoạt',PENDING_ACTIVATION:'Chờ kích hoạt',NO_ACCOUNT:'Chưa có tài khoản'} as Record<string,string>)[v]??v;}
  accountLabel(v?:string|null):string{return !v?'Chưa áp dụng':v==='BLOCKED'?'Đã chặn':v==='ACTIVE'?'Đang hoạt động':v;}
  orderStatus(v:string):string{return ({PENDING:'Chờ xác nhận',CONFIRMED:'Đã xác nhận',PROCESSING:'Chuẩn bị hàng',SHIPPED:'Đang giao',COMPLETED:'Đã giao',CANCELLED:'Đã hủy'} as Record<string,string>)[v]??v;}
  appointmentStatus(v:string):string{return ({PENDING_PAYMENT:'Chờ thanh toán',PENDING_CONFIRMATION:'Chờ xác nhận',CONFIRMED:'Đã xác nhận',IN_PROGRESS:'Đang phục vụ',COMPLETED:'Hoàn thành',CANCELLED:'Đã hủy',NO_SHOW:'Không đến'} as Record<string,string>)[v]??v;}
  /** Only show a branch name returned by BE. Never expose the raw ObjectId. */
  branchName(raw:unknown, fallback?:unknown):string {
    const populated=raw && typeof raw==='object' ? raw as {id?:string;_id?:string;name?:string} : null;
    const id=String(populated?.id ?? populated?._id ?? (typeof raw==='string'?raw:'')).trim();
    const lookedUp=id ? this.branchNames().get(id) : undefined;
    const provided=typeof fallback==='string' ? fallback.trim() : '';
    const inline=typeof populated?.name==='string' ? populated.name.trim() : '';
    const isIdentifier=(name:string)=>name===id || /^[a-f0-9]{24}$/i.test(name);
    return lookedUp || (inline && !isIdentifier(inline)?inline:'') || (provided && !isIdentifier(provided)?provided:'') || '—';
  }
  petName(p:any):string{return p.name||p.petName||p.pet_name||'Thú cưng';}
  petBreed(p:any):string{return p.breed||p.breedName||p.breed_name||'Chưa cập nhật giống';}
  petSpecies(p:any):string {
    const code=String(p.species||'').toUpperCase();
    const labels:Record<string,string>={DOG:'Chó',CAT:'Mèo',BIRD:'Chim',RABBIT:'Thỏ',OTHER:'Khác'};
    const detail=String(p.speciesDetail||p.speciesName||'').trim();
    return code==='OTHER' && detail ? 'Khác ('+detail+')' : labels[code]||p.species||'—';
  }
  petAge(p:any):string {
    const raw=p.ageYears??p.age??p.age_years;
    if(raw===null||raw===undefined||raw==='')return 'Chưa cập nhật';
    const value=Number(raw);
    return Number.isFinite(value)&&value>=0 ? new Intl.NumberFormat('vi-VN',{maximumFractionDigits:2}).format(value)+' tuổi' : 'Chưa cập nhật';
  }
  petImage(p:any):string{return getPrimaryImage(p)||'/assets/admin-login/mascot.png';}
  onPetImageError(event:Event):void {
    const image=event.target as HTMLImageElement|null;
    if(image && !image.src.endsWith('/assets/admin-login/mascot.png'))
      image.src='/assets/admin-login/mascot.png';
  }
  serviceNames(a:any):string{return (a.services||[]).map((s:any)=>s.serviceName||s.name).filter(Boolean).join(', ')||a.serviceType||'Dịch vụ';}
  money(v:any):string{return new Intl.NumberFormat('vi-VN').format(Number(v||0))+'đ';}
  date(v:any):string{if(!v)return '—';const d=new Date(v);return Number.isNaN(d.getTime())?'—':d.toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',year:'numeric',hour:'2-digit',minute:'2-digit'});}
}
