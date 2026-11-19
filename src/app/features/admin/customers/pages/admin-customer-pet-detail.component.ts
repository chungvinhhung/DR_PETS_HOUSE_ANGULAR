import { getPrimaryImage } from '../../../../core/customer/services/api/pet-api.service';
import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';

import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminBreadcrumbComponent } from '../../../../shared/admin-breadcrumb/admin-breadcrumb.component';
import { AdminDataStateComponent } from '../../../../shared/admin-data-state/admin-data-state.component';
import { AdminCustomerService } from '../services/admin-customer.service';

@Component({
 selector:'app-admin-customer-pet-detail',standalone:true,
 imports:[CommonModule,RouterLink,AdminCatalogShellComponent,AdminBreadcrumbComponent,AdminDataStateComponent],
 templateUrl:'./admin-customer-pet-detail.component.html',
 styleUrl:'./admin-customer-pet-detail.component.scss',
 changeDetection:ChangeDetectionStrategy.OnPush,
})
export class AdminCustomerPetDetailComponent{
 private readonly route=inject(ActivatedRoute);private readonly service=inject(AdminCustomerService);
 readonly pet=signal<any|null>(null);readonly loading=signal(true);readonly error=signal('');
 readonly customerId=this.route.snapshot.paramMap.get('customerId')||'';readonly petId=this.route.snapshot.paramMap.get('petId')||'';
 ngOnInit():void{this.load();}
 load():void{
  this.loading.set(true);this.error.set('');
  this.service.getPets(this.customerId).pipe(finalize(()=>this.loading.set(false))).subscribe({
   next:pets=>{this.pet.set(pets.find(p=>String(p._id||p.id)===this.petId)||null);if(!this.pet())this.error.set('Không tìm thấy hồ sơ thú cưng.');},
   error:()=>this.error.set('Đã có lỗi xảy ra khi tải hồ sơ thú cưng. Vui lòng thử lại.'),
  });
 }
 image(p:any):string{return getPrimaryImage(p)||'/assets/admin-login/mascot.png';}
  onPetImageError(event:Event):void {
    const image=event.target as HTMLImageElement|null;
    if(image && !image.src.endsWith('/assets/admin-login/mascot.png')) image.src='/assets/admin-login/mascot.png';
  }
  species(p:any):string {
    const kind=String(p?.species||'').toUpperCase();
    const labels:Record<string,string>={DOG:'Chó',CAT:'Mèo',BIRD:'Chim',RABBIT:'Thỏ',OTHER:'Khác'};
    const detail=String(p?.speciesDetail||p?.speciesName||'').trim();
    return kind==='OTHER' && detail ? 'Khác ('+detail+')' : labels[kind]||p?.species||'—';
  }
  age(p:any):string {
    const raw=p?.ageYears??p?.age??p?.age_years;
    return raw===null||raw===undefined||raw===''||!Number.isFinite(Number(raw))
      ? 'Chưa cập nhật' : new Intl.NumberFormat('vi-VN',{maximumFractionDigits:2}).format(Number(raw))+' tuổi';
  }
 value(...values:any[]):string{return values.find(v=>v!==undefined&&v!==null&&String(v).trim()!=='')??'—';}
}
