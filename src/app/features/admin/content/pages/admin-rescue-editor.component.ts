import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { firstValueFrom, timeout } from 'rxjs';

import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminBreadcrumbComponent } from '../../../../shared/admin-breadcrumb/admin-breadcrumb.component';
import { AdminContentService } from '../services/admin-content.service';
import { AdminProductService } from '../../products/services/admin-product.service';
import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { BranchApiRecord, BranchManagementApiService } from '../../branch-management/services/branch-management-api.service';
import { adminErrorMessage } from '../../../../shared/services/admin-toast.service';
import { RESCUE_PARTNERS } from '../../../customer/rescue/data/rescue-data';

type RescueSpecies='DOG'|'CAT'|'OTHER';
type RescueDraft={
  petName:string;species:RescueSpecies;rescueStory:string;healthStatus:string;
  supportNeeds:string;supportPartnerId:string;image:string;
};
const blank=():RescueDraft=>({
  petName:'',species:'DOG',rescueStory:'',healthStatus:'',
  supportNeeds:'',supportPartnerId:'',image:'',
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
  private readonly uploader=inject(AdminProductService);
  private readonly auth=inject(AuthSessionService);
  private readonly branchApi=inject(BranchManagementApiService);
  readonly isManager=computed(()=>this.auth.user()?.systemRole==='MANAGER');
  readonly managerBranches=signal<BranchApiRecord[]>([]);
  readonly branchesLoading=signal(false);
  readonly branchesError=signal('');
  readonly id=this.route.snapshot.paramMap.get('id')||'';
  readonly isEditing=Boolean(this.id);
  readonly canWrite=computed(()=>['ADMIN','MANAGER'].includes(this.auth.user()?.systemRole||''));
  readonly breadcrumb=[
    {label:'Cứu trợ & Nhận nuôi',link:'/admin/content/rescue'},
    {label:this.isEditing?'Chỉnh sửa hồ sơ':'Thêm hồ sơ'},
  ];
  readonly partners=RESCUE_PARTNERS;
  readonly draft=signal<RescueDraft>(blank());
  readonly selectedPartner=computed(()=>this.partners.find(p=>p.id===this.draft().supportPartnerId));
  readonly loading=signal(this.isEditing);
  readonly saving=signal(false);
  readonly uploading=signal(false);
  readonly dragging=signal(false);
  readonly loadError=signal('');
  readonly error=signal('');
  readonly uploadError=signal('');
  readonly dirty=signal(false);
  readonly petCode=signal('');
  readonly savedStatus=signal('LOOKING_FOR_HOME');
  // Preserve pre-existing BE-only attributes in old records, even though the
  // partner-card editor does not expose fields absent from the Customer card.
  private legacyFields:{breed:string;ageDescription:string;gender:string;branchId:string|null}={
    breed:'Chưa cập nhật',ageDescription:'Chưa cập nhật',gender:'UNKNOWN',branchId:null,
  };
  private savedId='';
  private leaving=false;
  ngOnInit():void {
    if(this.isManager())void this.loadManagerBranches();
    if(this.isEditing)void this.load();
  }
  private async loadManagerBranches():Promise<void> {
    this.branchesLoading.set(true);this.branchesError.set('');
    try {
      const assigned=new Set((this.auth.user()?.branchScope??[]).map(String));
      const all=await firstValueFrom(this.branchApi.listBranches().pipe(timeout({first:30000})));
      const visible=all.filter(branch=>assigned.has(String(branch.id)) && branch.status==='ACTIVE');
      this.managerBranches.set(visible);
      if(!this.isEditing && visible.length===1 && !this.legacyFields.branchId){
        this.legacyFields.branchId=visible[0].id;
      }
      if(!visible.length)this.branchesError.set('Không có chi nhánh đang hoạt động được phân công cho Manager.');
    }catch(err:unknown){
      this.branchesError.set(adminErrorMessage(err,'Không thể tải chi nhánh được phân công. Vui lòng thử lại.'));
    }finally{this.branchesLoading.set(false);}
  }
  get currentManagerBranch():string{return this.legacyFields.branchId??'';}
  selectManagerBranch(id:string):void {
    if(!this.isManager() || !this.managerBranches().some(branch=>branch.id===id))return;
    this.legacyFields.branchId=id;this.dirty.set(true);this.error.set('');
  }
  private async load():Promise<void>{
    this.loading.set(true);this.loadError.set('');
    try{
      const row=await firstValueFrom(this.api.getRescuePet(this.id).pipe(timeout({first:30000})));
      if(!row?._id&&!row?.id)throw Error('Không tìm thấy hồ sơ cứu trợ.');
      this.savedId=String(row._id||row.id);
      this.petCode.set(String(row.petCode||''));
      this.savedStatus.set(String(row.status||'LOOKING_FOR_HOME'));
      this.legacyFields={
        breed:String(row.breed||'Chưa cập nhật'),
        ageDescription:String(row.ageDescription||'Chưa cập nhật'),
        gender:String(row.gender||'UNKNOWN'),
        branchId:String(row.branchId?._id||row.branchId?.id||
          (typeof row.branchId==='string'?row.branchId:'')||'')||null,
      };
      this.draft.set({
        petName:String(row.petName||''),species:(['DOG','CAT','OTHER'].includes(row.species)?row.species:'DOG') as RescueSpecies,
        rescueStory:String(row.rescueStory||''),healthStatus:String(row.healthStatus||''),
        supportNeeds:String(row.supportNeeds||''),
        supportPartnerId:String(row.supportPartnerId||''),
        image:Array.isArray(row.images)?String(row.images[0]||''):'',
      });
      this.dirty.set(false);
    }catch(err:any){this.loadError.set(err?.error?.message||err?.message||'Không thể tải hồ sơ cứu trợ.');}
    finally{this.loading.set(false);}
  }
  setField<K extends keyof RescueDraft>(key:K,value:RescueDraft[K]):void{
    this.draft.update(current=>({...current,[key]:value}));
    this.dirty.set(true);this.error.set('');
  }
  updateStatus(value:string):void {
    if(value!=='LOOKING_FOR_HOME'&&value!=='ADOPTED')return;
    this.savedStatus.set(value);
    this.dirty.set(true);this.error.set('');
  }
  async onImageSelected(event:Event):Promise<void>{
    const input=event.target as HTMLInputElement;
    const file=input.files?.[0];input.value='';
    if(file)await this.uploadImage(file);
  }
  onImageDragOver(event:DragEvent):void{
    event.preventDefault();
    if(this.canWrite()&&!this.uploading()&&!this.saving())this.dragging.set(true);
  }
  onImageDragLeave(event:DragEvent):void{
    // Ignore moves between children of the dropzone.
    if(!(event.currentTarget as HTMLElement)?.contains(event.relatedTarget as Node|null)){
      this.dragging.set(false);
    }
  }
  async onImageDrop(event:DragEvent):Promise<void>{
    event.preventDefault();this.dragging.set(false);
    if(!this.canWrite()||this.uploading()||this.saving())return;
    const file=event.dataTransfer?.files?.[0];
    if(file)await this.uploadImage(file);
  }
  private async uploadImage(file:File):Promise<void>{
    if(!this.canWrite()||this.uploading()||this.saving())return;
    if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){
      this.uploadError.set('Chỉ nhận ảnh JPG, PNG hoặc WebP, dung lượng tối đa 5 MB.');return;
    }
    this.uploading.set(true);this.uploadError.set('');
    try{
      // Reuse the existing authenticated, multipart image uploader until BE
      // provides a dedicated /uploads/rescue contract.
      const response=await firstValueFrom(this.uploader.uploadImages([file]).pipe(timeout({first:45000})));
      const url=response.items?.[0]?.url;
      if(!url||!/^https?:\/\//i.test(url))throw Error('Máy chủ không trả về URL ảnh hợp lệ.');
      this.setField('image',url);
    }catch(err:any){
      this.uploadError.set(err?.error?.message||err?.message||'Không thể tải ảnh lên máy chủ.');
    }finally{this.uploading.set(false);}
  }
  removeImage():void{if(!this.uploading()&&!this.saving())this.setField('image','');}
  private buildPayload():Record<string,unknown>|null{
    const d=this.draft();
    if(!d.petName.trim()||!d.rescueStory.trim()||!d.healthStatus.trim()||!d.supportNeeds.trim()){
      this.error.set('Vui lòng nhập đủ tên thú cưng, câu chuyện, tình trạng và nhu cầu hỗ trợ.');return null;
    }
    if(!d.supportPartnerId||!this.selectedPartner()){
      this.error.set('Vui lòng chọn đúng đối tác cứu trợ phụ trách bé.');return null;
    }
    if(!d.image){
      this.error.set('Vui lòng tải ảnh thú cưng lên máy chủ trước khi lưu.');return null;
    }
    if(this.isManager() && (this.branchesLoading() || this.branchesError() ||
      !this.managerBranches().some(branch=>branch.id===this.legacyFields.branchId))){
      this.error.set('Vui lòng chọn chi nhánh đang hoạt động trong phạm vi được phân công trước khi lưu.');return null;
    }
    return {
      petName:d.petName.trim(),species:d.species,
      breed:this.legacyFields.breed,ageDescription:this.legacyFields.ageDescription,
      gender:this.legacyFields.gender,
      ...(this.legacyFields.branchId?{branchId:this.legacyFields.branchId}:{}),
      rescueStory:d.rescueStory.trim(),healthStatus:d.healthStatus.trim(),
      supportNeeds:d.supportNeeds.trim(),supportPartnerId:d.supportPartnerId,
      ...(this.isEditing||this.savedId?{status:this.savedStatus()}:{}),
      images:[d.image],
    };
  }
  async save():Promise<void>{
    if(!this.canWrite()||this.loading()||this.saving()||this.uploading())return;
    const body=this.buildPayload();if(!body)return;
    this.saving.set(true);this.error.set('');
    try{
      const id=this.savedId||this.id;
      const result=await firstValueFrom((id?this.api.updateRescuePet(id,body):this.api.createRescuePet(body))
        .pipe(timeout({first:45000})));
      if(!result?._id&&!result?.id)throw Error('BE chưa xác nhận mã hồ sơ; kiểm tra trước khi thử lại.');
      this.savedId=String(result._id||result.id);
      // Verify after a fresh GET, rather than trusting the POST/PATCH echo.
      // Current BE/dev accepts the request but drops partner-support metadata.
      const stored=await firstValueFrom(this.api.getRescuePet(this.savedId).pipe(timeout({first:30000})));
      if(String(stored?.supportPartnerId||'')!==this.draft().supportPartnerId||
        String(stored?.supportNeeds||'')!==this.draft().supportNeeds.trim()||
        !Array.isArray(stored?.images)||stored.images[0]!==this.draft().image||
        (this.isEditing&&String(stored?.status||'')!==this.savedStatus())){
        this.error.set('Hồ sơ đã được ghi nhận nhưng BE chưa lưu đối tác và nhu cầu hỗ trợ. Đã giữ nguyên dữ liệu nhập; cần BE bổ sung supportPartnerId và supportNeeds. Không tạo lại hồ sơ để tránh trùng.');
        this.dirty.set(true);
        return;
      }
      this.dirty.set(false);
      this.leaving=true;
      await this.router.navigate(['/admin/content/rescue'],{
        queryParams:{notice:this.isEditing?'Đã cập nhật hồ sơ cứu trợ.':'Đã tạo hồ sơ cứu trợ.'},
      });
    }catch(err:unknown){this.error.set(adminErrorMessage(err,'Không thể lưu hồ sơ. Vui lòng thử lại.'));}
    finally{this.saving.set(false);}
  }
  cancel():void{
    if(this.dirty()&&typeof window!=='undefined'&&
      !window.confirm('Nội dung chưa lưu sẽ bị mất. Bạn có muốn rời trang?'))return;
    this.leaving=true;void this.router.navigate(['/admin/content/rescue']);
  }
  @HostListener('window:beforeunload',['$event'])
  beforeUnload(event:BeforeUnloadEvent):void{
    if(this.dirty()&&!this.leaving)event.preventDefault();
  }
}
