import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ApiClientService } from '../../../../core/services/api-client.service';
import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminToastService, adminErrorMessage } from '../../../../shared/services/admin-toast.service';
import {
  AdminInventoryService,
  InventoryItemDto,
  InventoryTransactionDto,
} from '../../inventory/services/admin-inventory.service';
import { AdminInventoryTransactionDrawerComponent } from '../../inventory/components/admin-inventory-transaction-drawer.component';
import {
  AppointmentView,
  normalizeAppointmentDetail,
} from './admin-appointment-workflow.model';
import {
  MaterialUsage,
  ServiceRecord,
  canFinalizeServiceRecord,
  normalizeServiceRecordDetail,
  serviceRecordStatusLabel,
} from './admin-service-record.model';

type EditorDialog = 'materials' | 'professional' | 'reopen' | 'finalize' | null;

interface MaterialDraft {
  inventoryItemId: string;
  quantity: number | null;
  unit: string;
  notes: string;
}
interface ProfessionalDraft {
  diagnosis: string;
  treatment: string;
  result: string;
  professionalNote: string;
}

@Component({
  selector:'app-admin-service-record-detail',
  standalone:true,
  imports:[RouterLink,AdminCatalogShellComponent,AdminInventoryTransactionDrawerComponent],
  templateUrl:'./admin-service-record-detail.component.html',
  styleUrl:'./admin-service-record-detail.component.scss',
  changeDetection:ChangeDetectionStrategy.OnPush,
})
export class AdminServiceRecordDetailComponent {
  private readonly api=inject(ApiClientService);
  private readonly session=inject(AuthSessionService);
  private readonly inventoryApi=inject(AdminInventoryService);
  private readonly toast=inject(AdminToastService);
  private readonly route=inject(ActivatedRoute);
  private readonly destroyRef=inject(DestroyRef);
  private requestVersion=0;

  readonly id=signal(this.route.snapshot.paramMap.get('id')||'');
  readonly loading=signal(false);
  readonly error=signal('');
  readonly item=signal<ServiceRecord|null>(null);
  readonly appointment=signal<AppointmentView|null>(null);

  readonly inventoryItems=signal<InventoryItemDto[]>([]);
  readonly inventoryTransactions=signal<InventoryTransactionDto[]>([]);
  readonly inventoryLoaded=signal(false);
  readonly selectedTransactions=signal<InventoryTransactionDto[]>([]);
  readonly selectedTransactionCode=signal('');
  readonly inventoryDrawerOpen=signal(false);

  readonly dialog=signal<EditorDialog>(null);
  readonly dialogError=signal('');
  readonly actionError=signal('');
  readonly busy=signal(false);
  readonly materialDrafts=signal<MaterialDraft[]>([]);
  readonly professionalDraft=signal<ProfessionalDraft>({
    diagnosis:'',treatment:'',result:'',professionalNote:'',
  });
  readonly reopenReason=signal('');
  readonly finalizeReason=signal('');

  readonly serviceRecordStatusLabel=serviceRecordStatusLabel;
  readonly currentUser=computed(()=>this.session.user());
  readonly isNurse=computed(()=>this.currentUser()?.systemRole==='STAFF' && this.currentUser()?.staffSubRole==='NURSE');
  readonly isVet=computed(()=>this.currentUser()?.systemRole==='STAFF' && this.currentUser()?.staffSubRole==='VETERINARIAN');
  readonly isGroomer=computed(()=>this.currentUser()?.systemRole==='STAFF' && this.currentUser()?.staffSubRole==='CARE_STAFF_GROOMER');
  readonly isManagerOrAdmin=computed(()=>this.session.hasAnyRole(['MANAGER','ADMIN']));

  readonly materialOptions=computed(()=>
    this.inventoryItems().filter(item=>item.status==='ACTIVE' && item.kind==='MATERIAL'));

  readonly canEditMaterials=computed(()=>{
    const r=this.item(); if(!r || r.status==='COMPLETED') return false;
    if(r.category==='GROOMING') return this.isGroomer();
    if(r.category==='MEDICAL') return this.isNurse() || this.isVet();
    return false;
  });

  readonly canEditProfessional=computed(()=>{
    const r=this.item(); if(!r || r.category!=='MEDICAL' || r.status==='COMPLETED') return false;
    return this.isVet();
  });

  readonly canSubmitReview=computed(()=>{
    const r=this.item();
    return !!r && r.category==='MEDICAL' && r.status==='IN_PROGRESS' && this.isNurse();
  });

  readonly canFinalize=computed(()=>{
    const r=this.item(); if(!r || !canFinalizeServiceRecord(r).allowed) return false;
    return r.category==='MEDICAL' ? this.isVet() : r.category==='GROOMING' ? this.isGroomer() : false;
  });

  readonly canReopen=computed(()=>{
    const r=this.item();
    return !!r && r.status==='COMPLETED' && this.isManagerOrAdmin();
  });
  readonly showProfessionalPanel=computed(()=>{
    const r=this.item();
    const user=this.currentUser();
    return !!r && r.category==='MEDICAL' && user?.systemRole==='STAFF' &&
      (user.staffSubRole==='VETERINARIAN' || user.staffSubRole==='NURSE');
  });
  readonly showRecordActions=computed(()=>
    this.canSubmitReview() || this.canFinalize() || this.canReopen() ||
    (this.item()?.status==='IN_PROGRESS' && this.item()?.category==='MEDICAL' && this.isNurse()) ||
    (this.item()?.status==='AWAITING_VET_REVIEW' && this.item()?.category==='MEDICAL')
  );

  constructor(){
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params=>{
      const id=params.get('id')||'';
      if(id && id!==this.id()){
        this.id.set(id);
        this.closeDialog();
        this.closeInventoryDrawer();
        this.load();
      }
    });
    this.loadInventoryItems();
    this.load();
  }

  load():void{
    const id=this.id();
    if(!id){this.error.set('Không có mã định danh hồ sơ.');return;}
    const version=++this.requestVersion;
    this.loading.set(true);this.error.set('');this.actionError.set('');
    this.api.get<unknown>('/service-records/'+encodeURIComponent(id))
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next:raw=>{
          if(version!==this.requestVersion)return;
          try{
            const r=normalizeServiceRecordDetail(raw);
            if(r.id!==id)throw new Error('API trả hồ sơ không khớp ID.');
            this.item.set(r);
            this.loading.set(false);
            if(r.appointmentId)this.loadAppointment(r.appointmentId,version);
          }catch(err){
            this.error.set(err instanceof Error?err.message:'Không đọc được hồ sơ.');
            this.loading.set(false);
          }
        },
        error:err=>{
          if(version!==this.requestVersion)return;
          this.error.set(adminErrorMessage(err,'Không tải được chi tiết hồ sơ.'));
          this.loading.set(false);
        },
      });
  }

  private loadAppointment(id:string,version:number):void{
    this.appointment.set(null);
    this.api.get<unknown>('/appointments/'+encodeURIComponent(id))
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next:raw=>{
          if(version!==this.requestVersion)return;
          try{this.appointment.set(normalizeAppointmentDetail(raw));}catch{this.appointment.set(null);}
        },
        error:()=>{if(version===this.requestVersion)this.appointment.set(null);},
      });
  }

  private loadInventoryItems():void{
    this.inventoryApi.listItems().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:items=>this.inventoryItems.set(items),
      error:()=>this.inventoryItems.set([]),
    });
  }

  displayRecordCode(r:ServiceRecord):string{
    const code=(r.code||'').trim();
    if(!code || code===r.id || /^[a-f0-9]{24}$/i.test(code)) return '';
    return code.replace(/^#/,'');
  }

  displayTime(value:string|null):string{
    if(!value)return '—';
    const d=new Date(value);if(Number.isNaN(d.getTime()))return value;
    return new Intl.DateTimeFormat('vi-VN',{
      timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric',
      hour:'2-digit',minute:'2-digit',hour12:false,
    }).format(d);
  }

  appointmentTime(r:ServiceRecord):string{
    const a=this.appointment();
    return a?.appointmentAt ? this.displayTime(a.appointmentAt) : this.displayTime(r.date);
  }

  appointmentCode(r:ServiceRecord):string{
    return this.appointment()?.code || r.appointmentCode || r.appointmentId;
  }

  petLabel(r:ServiceRecord):string{
    return r.petName || r.petId || 'Chưa có dữ liệu';
  }

  petInitial(r:ServiceRecord):string{
    return (r.petName || 'P').trim().slice(0,1).toUpperCase() || 'P';
  }

  serviceLabel(r:ServiceRecord):string{
    return r.serviceName || r.serviceIds.join(', ') || 'Chưa có dữ liệu';
  }

  staffLabel(r:ServiceRecord):string{
    if(r.primaryStaff)return r.primaryRole ? r.primaryStaff+' · '+r.primaryRole : r.primaryStaff;
    return r.assignedStaffIds.join(', ') || 'Chưa có dữ liệu';
  }

  recordNote(r:ServiceRecord):string{
    return r.note || r.professional?.result || r.professional?.professionalNote || 'Chưa có kết quả hoặc ghi chú.';
  }

  reviewLabel(r:ServiceRecord):string{
    if(r.status==='AWAITING_VET_REVIEW')return 'Chờ Bác sĩ duyệt';
    if(r.status==='COMPLETED')return 'Đã chốt';
    if(r.reviewerStaffId)return 'Đã chỉ định Bác sĩ';
    return 'Chưa gửi duyệt';
  }

  statusTone(r:ServiceRecord):string{
    return r.status==='COMPLETED'?'success':r.status==='AWAITING_VET_REVIEW'?'warning':
      r.status==='IN_PROGRESS'||r.status==='REOPENED'?'info':'neutral';
  }

  materialName(m:MaterialUsage):string{
    const item=this.inventoryItems().find(v=>v.id===m.inventoryItemId);
    return item?.name || m.name || m.inventoryItemId || '—';
  }

  quantityText(value:string,unit:string):string{
    return value!=='' ? value+(unit?' '+unit:'') : '—';
  }

  openMaterialsEditor():void{
    const r=this.item();if(!r)return;
    this.materialDrafts.set(r.materials.map(m=>({
      inventoryItemId:m.inventoryItemId,
      quantity:this.numberOrNull(m.actualQuantity!==''?m.actualQuantity:m.templateQuantity),
      unit:m.unit || this.inventoryItems().find(v=>v.id===m.inventoryItemId)?.unit || '',
      notes:m.note,
    })));
    if(!this.materialDrafts().length)this.addMaterial();
    this.dialogError.set('');this.dialog.set('materials');
  }

  addMaterial():void{
    this.materialDrafts.update(rows=>[...rows,{inventoryItemId:'',quantity:null,unit:'',notes:''}]);
  }

  removeMaterial(index:number):void{
    this.materialDrafts.update(rows=>rows.filter((_,i)=>i!==index));
  }

  selectMaterial(index:number,id:string):void{
    const item=this.inventoryItems().find(v=>v.id===id);
    this.materialDrafts.update(rows=>rows.map((row,i)=>i===index?{
      ...row,inventoryItemId:id,unit:row.unit||item?.unit||'',
    }:row));
  }

  updateMaterialQuantity(index:number,value:string):void{
    const quantity=value.trim()===''?null:Number(value);
    this.materialDrafts.update(rows=>rows.map((row,i)=>i===index?{
      ...row,quantity:Number.isFinite(quantity as number)?quantity:null,
    }:row));
  }

  updateMaterialField(index:number,field:'unit'|'notes',value:string):void{
    this.materialDrafts.update(rows=>rows.map((row,i)=>i===index?{...row,[field]:value}:row));
  }

  saveMaterials():void{
    const r=this.item();if(!r||this.busy())return;
    const rows=this.materialDrafts();
    if(rows.some(row=>!row.inventoryItemId || row.quantity===null || row.quantity<0)){
      this.dialogError.set('Chọn vật tư và nhập số lượng thực tế hợp lệ cho tất cả các dòng.');
      return;
    }
    const ids=rows.map(row=>row.inventoryItemId);
    if(new Set(ids).size!==ids.length){
      this.dialogError.set('Mỗi vật tư chỉ nên xuất hiện một lần trong danh sách thực tế.');
      return;
    }
    this.busy.set(true);this.dialogError.set('');
    this.api.put<unknown>('/service-records/'+encodeURIComponent(r.id)+'/materials',{
      expectedVersion:r.version??undefined,
      materials:rows.map(row=>({
        inventoryItemId:row.inventoryItemId,quantity:row.quantity,unit:row.unit||undefined,notes:row.notes||undefined,
      })),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:raw=>this.acceptMutation(raw,'Đã cập nhật vật liệu thực tế.'),
      error:err=>this.failDialog(err,'Không cập nhật được vật liệu.'),
    });
  }

  openProfessionalEditor():void{
    const p=this.item()?.professional;
    this.professionalDraft.set({
      diagnosis:p?.diagnosis||'',treatment:p?.treatment||'',result:p?.result||'',professionalNote:p?.professionalNote||'',
    });
    this.dialogError.set('');this.dialog.set('professional');
  }

  updateProfessionalField(field:keyof ProfessionalDraft,value:string):void{
    this.professionalDraft.update(current=>({...current,[field]:value}));
  }

  saveProfessional():void{
    const r=this.item();if(!r||this.busy())return;
    this.busy.set(true);this.dialogError.set('');
    this.api.put<unknown>('/service-records/'+encodeURIComponent(r.id)+'/professional',{
      expectedVersion:r.version??undefined,
      ...this.professionalDraft(),
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:raw=>this.acceptMutation(raw,'Đã cập nhật nội dung chuyên môn.'),
      error:err=>this.failDialog(err,'Không cập nhật được nội dung chuyên môn.'),
    });
  }

  submitForReview():void{
    const r=this.item();if(!r||this.busy())return;
    this.busy.set(true);this.actionError.set('');
    this.api.post<unknown>('/service-records/'+encodeURIComponent(r.id)+'/submit-review',{
      expectedVersion:r.version??undefined,
    },{headers:this.idempotencyHeaders()}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:raw=>this.acceptActionMutation(raw,'Đã gửi hồ sơ cho Bác sĩ thú y duyệt.'),
      error:err=>this.failAction(err,'Không gửi được hồ sơ cho Bác sĩ duyệt.'),
    });
  }

  requestFinalize():void{
    const r=this.item();if(!r||this.busy())return;
    if((r.recordVersion??0)>0){
      this.finalizeReason.set('');this.dialogError.set('');this.dialog.set('finalize');return;
    }
    this.finalizeRecord('');
  }

  finalizeRecord(reason:string):void{
    const r=this.item();if(!r||this.busy())return;
    if((r.recordVersion??0)>0 && reason.trim().length<3){
      this.dialogError.set('Vui lòng nhập lý do hiệu chỉnh ít nhất 3 ký tự.');return;
    }
    this.busy.set(true);this.dialogError.set('');this.actionError.set('');
    this.api.post<unknown>('/service-records/'+encodeURIComponent(r.id)+'/finalize',{
      expectedVersion:r.version??undefined,
      reason:reason.trim()||undefined,
    },{headers:this.idempotencyHeaders()}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:raw=>this.acceptActionMutation(raw,'Đã chốt hồ sơ dịch vụ. Hệ thống sẽ tự cập nhật lịch hẹn khi đủ điều kiện.'),
      error:err=>{
        if(this.dialog()==='finalize')this.failDialog(err,'Không thể chốt hồ sơ.');
        else this.failAction(err,'Không thể chốt hồ sơ.');
      },
    });
  }

  openReopenDialog():void{
    this.reopenReason.set('');this.dialogError.set('');this.dialog.set('reopen');
  }

  reopenRecord():void{
    const r=this.item();if(!r||this.busy())return;
    if(this.reopenReason().trim().length<3){
      this.dialogError.set('Vui lòng nhập lý do mở lại ít nhất 3 ký tự.');return;
    }
    this.busy.set(true);this.dialogError.set('');
    this.api.post<unknown>('/service-records/'+encodeURIComponent(r.id)+'/reopen',{
      expectedVersion:r.version??undefined,reason:this.reopenReason().trim(),
    },{headers:this.idempotencyHeaders()}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:raw=>this.acceptMutation(raw,'Đã mở lại hồ sơ dịch vụ.'),
      error:err=>this.failDialog(err,'Không thể mở lại hồ sơ.'),
    });
  }

  openInventoryTransaction(code:string):void{
    if(!code)return;
    const open=(transactions:InventoryTransactionDto[])=>{
      const rows=transactions.filter(tx=>
        tx.id===code || tx.transactionCode===code || tx.groupCode===code || tx.code===code);
      if(!rows.length){
        this.toast.show('Backend chưa cung cấp liên kết giao dịch kho cho mã này.','info');
        return;
      }
      this.selectedTransactionCode.set(code);
      this.selectedTransactions.set(rows);
      this.inventoryDrawerOpen.set(true);
    };
    if(this.inventoryLoaded()){open(this.inventoryTransactions());return;}
    this.inventoryApi.listTransactions().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:rows=>{this.inventoryTransactions.set(rows);this.inventoryLoaded.set(true);open(rows);},
      error:()=>this.toast.show('Không tải được giao dịch kho liên quan.','error'),
    });
  }

  closeInventoryDrawer():void{
    this.inventoryDrawerOpen.set(false);this.selectedTransactions.set([]);this.selectedTransactionCode.set('');
  }

  closeDialog():void{
    if(this.busy())return;
    this.dialog.set(null);this.dialogError.set('');
  }

  private acceptMutation(raw:unknown,message:string):void{
    try{
      this.item.set(normalizeServiceRecordDetail(raw));
      this.busy.set(false);this.dialog.set(null);this.dialogError.set('');
      this.toast.show(message,'success');
    }catch{
      this.busy.set(false);this.dialog.set(null);this.toast.show(message,'success');this.load();
    }
  }

  private acceptActionMutation(raw:unknown,message:string):void{
    this.acceptMutation(raw,message);
    this.actionError.set('');
  }

  private failDialog(error:unknown,fallback:string):void{
    this.busy.set(false);this.dialogError.set(adminErrorMessage(error,fallback));
  }

  private failAction(error:unknown,fallback:string):void{
    this.busy.set(false);this.actionError.set(adminErrorMessage(error,fallback));
    this.toast.show(this.actionError(),'error');
  }

  private numberOrNull(value:string):number|null{
    if(value.trim()==='')return null;const n=Number(value);return Number.isFinite(n)?n:null;
  }

  private idempotencyHeaders():HttpHeaders{
    const key=typeof crypto!=='undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID()
      : 'sr-'+Date.now()+'-'+Math.random().toString(36).slice(2);
    return new HttpHeaders({'Idempotency-Key':key});
  }
}
