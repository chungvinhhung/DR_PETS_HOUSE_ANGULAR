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
 ngOnInit():void{this.service.getPets(this.customerId).pipe(finalize(()=>this.loading.set(false))).subscribe({next:pets=>{this.pet.set(pets.find(p=>String(p._id||p.id)===this.petId)||null);if(!this.pet())this.error.set('Không tìm thấy hồ sơ thú cưng.');},error:()=>this.error.set('Không thể tải hồ sơ thú cưng.')});}
 image(p:any):string{return p?.profileImageUrl||p?.profile_image_url||p?.imageUrl||'/assets/customer/images/booking/pet_picker_luna_photo.jpg';}
 value(...values:any[]):string{return values.find(v=>v!==undefined&&v!==null&&String(v).trim()!=='')??'—';}
}
