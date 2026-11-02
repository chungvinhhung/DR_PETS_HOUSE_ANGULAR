import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminContentService } from '../services/admin-content.service';
@Component({selector:'app-admin-adoption-detail',standalone:true,imports:[RouterLink,AdminCatalogShellComponent],templateUrl:'./admin-adoption-detail.component.html',styleUrl:'./admin-adoption-detail.component.scss',changeDetection:ChangeDetectionStrategy.OnPush})
export class AdminAdoptionDetailComponent{
 private readonly route=inject(ActivatedRoute);private readonly api=inject(AdminContentService);readonly data=signal<any|null>(null);readonly loading=signal(true);readonly error=signal('');readonly id=this.route.snapshot.paramMap.get('id')||'';
 ngOnInit():void{this.api.listAdoptionRequests().pipe(finalize(()=>this.loading.set(false))).subscribe({next:rows=>{this.data.set(rows.find(r=>String(r.id||r._id)===this.id)||null);if(!this.data())this.error.set('Backend chưa trả đơn đăng ký nhận nuôi này cho Admin.');},error:()=>this.error.set('Không thể tải đơn đăng ký nhận nuôi.')});}
 value(...v:any[]):string{return v.find(x=>x!==undefined&&x!==null&&String(x).trim()!=='')??'—';}
}
