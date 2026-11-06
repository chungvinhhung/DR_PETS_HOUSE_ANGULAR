import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminBreadcrumbComponent } from '../../../../shared/admin-breadcrumb/admin-breadcrumb.component';
import { AdminContentService } from '../services/admin-content.service';
import { BranchManagementApiService, BranchApiRecord } from '../../branch-management/services/branch-management-api.service';
import { AuthSessionService } from '../../../../core/services/auth-session.service';

type RescueSpecies='DOG'|'CAT'|'OTHER';
type RescueGender='MALE'|'FEMALE'|'UNKNOWN';
type RescueDraft={
  petName:string;species:RescueSpecies;breed:string;gender:RescueGender;
  ageDescription:string;healthStatus:string;rescueStory:string;
  imagesText:string;branchId:string;
};
const newRescueDraft=():RescueDraft=>({
  petName:'',species:'DOG',breed:'',gender:'UNKNOWN',
  ageDescription:'',healthStatus:'',rescueStory:'',imagesText:'',branchId:'',
});

@Component({
  selector:'app-admin-rescue-editor',
  standalone:true,
  imports:[CommonModule,FormsModule,AdminCatalogShellComponent,AdminBreadcrumbComponent],
  templateUrl:'./admin-rescue-editor.component.html',
  styleUrl:'./admin-rescue-editor.component.scss',
  changeDetection:ChangeDetectionStrategy.OnPush,
})
export class AdminRescueEditorComponent {
  private readonly route=inject(ActivatedRoute);
  private readonly router=inject(Router);
  private readonly api=inject(AdminContentService);
  private readonly branchesApi=inject(BranchManagementApiService);
  private readonly auth=inject(AuthSessionService);
  readonly id=this.route.snapshot.paramMap.get('id')||'';
  readonly isEditing=Boolean(this.id);
  readonly canWrite=computed(()=>['ADMIN','MANAGER'].includes(this.auth.user()?.systemRole||''));
  readonly breadcrumb=[
    {label:'Cứu trợ & Nhận nuôi',link:'/admin/content/rescue'},
    {label:this.isEditing?'Chỉnh sửa hồ sơ':'Thêm hồ sơ'},
  ];
  readonly draft=signal<RescueDraft>(newRescueDraft());
  readonly branches=signal<BranchApiRecord[]>([]);
  readonly branchesError=signal('');
  readonly loading=signal(this.isEditing);
  readonly saving=signal(false);
  readonly loadError=signal('');
  readonly error=signal('');
  readonly dirty=signal(false);
  readonly petCode=signal('');
  readonly savedStatus=signal('LOOKING_FOR_HOME');
  private leaving=false;
  readonly previewImages=computed(()=>this.draft().imagesText
    .split(/\r?\n/).map(s=>s.trim()).filter(Boolean));
  readonly previewImage=computed(()=>this.previewImages()[0]||'');
  readonly branchName=computed(()=>{
    const id=this.draft().branchId;
    return this.branches().find(item=>item.id===id)?.name || '';
  });

  ngOnInit():void {
    void this.loadBranches();
    if(this.isEditing)void this.load();
  }
  private async loadBranches():Promise<void> {
    try {
      const items=await firstValueFrom(this.branchesApi.listBranches());
      this.branches.set(Array.isArray(items)?items:[]);
    } catch {
      this.branchesError.set('Không tải được danh sách chi nhánh. Bạn vẫn có thể lưu mà không thay đổi chi nhánh.');
    }
  }
  private async load():Promise<void> {
    this.loading.set(true);this.loadError.set('');
    try {
      const row=await firstValueFrom(this.api.getRescuePet(this.id));
      if(!row?._id && !row?.id)throw Error('Không tìm thấy hồ sơ cứu trợ trên BE.');
      this.petCode.set(String(row.petCode||''));
      this.savedStatus.set(String(row.status||'LOOKING_FOR_HOME'));
      this.draft.set({
        petName:String(row.petName||''),
        species:(['DOG','CAT','OTHER'].includes(row.species)?row.species:'DOG') as RescueSpecies,
        breed:String(row.breed||''),
        gender:(['MALE','FEMALE','UNKNOWN'].includes(row.gender)?row.gender:'UNKNOWN') as RescueGender,
        ageDescription:String(row.ageDescription||''),
        healthStatus:String(row.healthStatus||''),
        rescueStory:String(row.rescueStory||''),
        imagesText:Array.isArray(row.images)?row.images.filter((v:unknown):v is string=>typeof v==='string').join('\n'):'',
        branchId:String(row.branchId?._id||row.branchId?.id||(typeof row.branchId==='string'?row.branchId:'')||''),
      });
      this.dirty.set(false);
    } catch(err:any) {
      this.loadError.set(err?.error?.message||err?.message||'Không thể tải hồ sơ cứu trợ.');
    } finally {
      this.loading.set(false);
    }
  }
  setField<K extends keyof RescueDraft>(key:K,value:RescueDraft[K]):void {
    this.draft.update(current=>({...current,[key]:value}));
    this.dirty.set(true);this.error.set('');
  }
  private buildPayload():Record<string,unknown>|null {
    const d=this.draft();
    if(!d.petName.trim()||!d.breed.trim()||!d.ageDescription.trim()||
       !d.healthStatus.trim()||!d.rescueStory.trim()){
      this.error.set('Vui lòng nhập đầy đủ các trường bắt buộc.');return null;
    }
    const images=this.previewImages();
    if(images.length===0){
      this.error.set('Vui lòng cung cấp ít nhất một URL ảnh thật; BE hiện tự thay bằng ảnh mẫu khi bỏ trống.');return null;
    }
    if(images.length>8){
      this.error.set('Tối đa 8 ảnh cho mỗi hồ sơ.');return null;
    }
    for(const src of images){
      try {
        if(!['http:','https:'].includes(new URL(src).protocol))throw Error('invalid protocol');
      } catch {
        this.error.set('Đường dẫn ảnh không hợp lệ. Mỗi dòng phải là URL http(s) của ảnh đã lưu trên máy chủ.');
        return null;
      }
    }
    return {
      petName:d.petName.trim(),species:d.species,breed:d.breed.trim(),gender:d.gender,
      ageDescription:d.ageDescription.trim(),healthStatus:d.healthStatus.trim(),
      rescueStory:d.rescueStory.trim(),images,
      branchId:d.branchId||null,
    };
  }
  async save():Promise<void> {
    if(!this.canWrite()||this.loading()||this.saving())return;
    const body=this.buildPayload();if(!body)return;
    this.saving.set(true);this.error.set('');
    try {
      const result=await firstValueFrom(this.isEditing
        ? this.api.updateRescuePet(this.id,body)
        : this.api.createRescuePet(body));
      if(!result?._id && !result?.id){
        throw Error('BE chưa xác nhận mã hồ sơ sau khi lưu. Vui lòng kiểm tra danh sách trước khi thử lại.');
      }
      this.dirty.set(false);this.leaving=true;
      await this.router.navigate(['/admin/content/rescue'],{
        queryParams:{notice:this.isEditing?'Đã cập nhật hồ sơ cứu trợ.':'Đã tạo hồ sơ cứu trợ.'},
      });
    } catch(err:any) {
      this.error.set(err?.error?.message||err?.message||'Không thể lưu hồ sơ cứu trợ. Vui lòng thử lại.');
    } finally {this.saving.set(false);}
  }
  cancel():void {
    if(this.dirty() && typeof window!=='undefined' &&
      !window.confirm('Nội dung chưa lưu sẽ bị mất. Bạn có muốn rời trang?'))return;
    this.leaving=true;void this.router.navigate(['/admin/content/rescue']);
  }
  @HostListener('window:beforeunload',['$event'])
  beforeUnload(event:BeforeUnloadEvent):void {
    if(this.dirty()&&!this.leaving)event.preventDefault();
  }
}
