import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { HttpHeaders } from '@angular/common/http';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ApiClientService } from '../../../../core/services/api-client.service';
import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminBreadcrumbComponent } from '../../../../shared/admin-breadcrumb/admin-breadcrumb.component';
import { AdminDataStateComponent } from '../../../../shared/admin-data-state/admin-data-state.component';
import { AdminToastService, adminErrorMessage } from '../../../../shared/services/admin-toast.service';
import {
  AdminInventoryService,
  InventoryItemDto,
  InventoryStockDto,
  InventoryTransactionDto,
} from '../../inventory/services/admin-inventory.service';
import { AdminInventoryTransactionDrawerComponent } from '../../inventory/components/admin-inventory-transaction-drawer.component';
import { AdminStaffApiService } from '../../staff/services/admin-staff-api.service';
import { displayStaffName } from '../../staff/models/staff-preview.model';
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
  imports:[RouterLink,AdminCatalogShellComponent,AdminBreadcrumbComponent,AdminDataStateComponent,AdminInventoryTransactionDrawerComponent],
  templateUrl:'./admin-service-record-detail.component.html',
  styleUrl:'./admin-service-record-detail.component.scss',
  changeDetection:ChangeDetectionStrategy.OnPush,
})
export class AdminServiceRecordDetailComponent {
  private readonly api=inject(ApiClientService);
  private readonly session=inject(AuthSessionService);
  private readonly inventoryApi=inject(AdminInventoryService);
  readonly staffDirectory=inject(AdminStaffApiService);
  private readonly toast=inject(AdminToastService);
  private readonly route=inject(ActivatedRoute);
  private readonly destroyRef=inject(DestroyRef);
  private requestVersion=0;
  private readonly mutationKeys=new Map<string,string>();

  readonly id=signal(this.route.snapshot.paramMap.get('id')||'');
  readonly loading=signal(false);
  readonly error=signal('');
  readonly item=signal<ServiceRecord|null>(null);
  readonly appointment=signal<AppointmentView|null>(null);

  readonly inventoryItems=signal<InventoryItemDto[]>([]);
  readonly inventoryBranches=signal<{id:string;name:string}[]>([]);
  readonly inventoryStocks=signal<InventoryStockDto[]>([]);
  readonly inventoryTransactions=signal<InventoryTransactionDto[]>([]);
  readonly inventoryLoaded=signal(false);
  readonly inventoryTransactionsLoading=signal(false);
  readonly inventoryTransactionsError=signal('');
  readonly selectedTransactions=signal<InventoryTransactionDto[]>([]);
  readonly selectedTransactionCode=signal('');
  readonly inventoryDrawerOpen=signal(false);

  readonly dialog=signal<EditorDialog>(null);
  readonly dialogError=signal('');
  readonly actionError=signal('');
  readonly busy=signal(false);
  readonly materialDrafts=signal<MaterialDraft[]>([]);
  readonly materialEditorMode=signal<'add'|'correct'>('add');
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

  readonly canReadInventoryTransactions=computed(()=>this.isManagerOrAdmin());
  readonly materialOptions=computed(()=>{
    const r=this.item();
    const currentIds=new Set((r?.materials ?? []).map(row=>row.inventoryItemId));
    const stockedIds=new Set(this.inventoryStocks().map(row=>row.inventoryItemId));
    return this.inventoryItems().filter(item=>
      item.status==='ACTIVE' && item.kind==='MATERIAL' &&
      (stockedIds.has(item.id) || currentIds.has(item.id)));
  });

  readonly canEditMaterials=computed(()=>{
    const r=this.item();
    if(!r || !['IN_PROGRESS','REOPENED'].includes(r.status)) return false;
    if(this.isManagerOrAdmin()) return true;
    if(r.category==='GROOMING') return this.isGroomer();
    if(r.category==='MEDICAL') return this.isNurse() || this.isVet();
    return false;
  });

  readonly canEditProfessional=computed(()=>{
    const r=this.item();
    if(!r || r.category!=='MEDICAL' ||
      !['IN_PROGRESS','WAITING_VET_REVIEW','REOPENED'].includes(r.status)) return false;
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
    (this.item()?.status==='WAITING_VET_REVIEW' && this.item()?.category==='MEDICAL' && this.isVet())
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
    this.loadBranches();
    this.staffDirectory.loadRoster();
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
            if(r.id!==id)throw new Error('Dữ liệu hồ sơ không khớp yêu cầu. Vui lòng tải lại.');
            this.item.set(r);
            this.loading.set(false);
            this.loadInventoryForRecord(r,version);
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

  private loadBranches():void{
    this.inventoryApi.listBranches().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:rows=>this.inventoryBranches.set(rows.map(row=>({id:row.id,name:row.name}))),
      error:()=>this.inventoryBranches.set([]),
    });
  }

  private loadInventoryForRecord(r:ServiceRecord,version:number):void{
    this.inventoryApi.listStocks(r.branchId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:rows=>{if(version===this.requestVersion)this.inventoryStocks.set(rows);},
      error:()=>{if(version===this.requestVersion)this.inventoryStocks.set([]);},
    });

    this.inventoryTransactions.set([]);
    this.inventoryLoaded.set(false);
    this.inventoryTransactionsError.set('');
    if(!this.canReadInventoryTransactions())return;

    this.inventoryTransactionsLoading.set(true);
    this.inventoryApi.listTransactions({
      sourceType:'SERVICE_RECORD',
      sourceId:r.id,
      branchId:r.branchId || undefined,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:rows=>{
        if(version!==this.requestVersion)return;
        this.inventoryTransactions.set(rows);
        this.inventoryLoaded.set(true);
        this.inventoryTransactionsLoading.set(false);
      },
      error:err=>{
        if(version!==this.requestVersion)return;
        this.inventoryTransactions.set([]);
        this.inventoryLoaded.set(true);
        this.inventoryTransactionsLoading.set(false);
        this.inventoryTransactionsError.set(adminErrorMessage(err,'Không tải được giao dịch kho liên quan.'));
      },
    });
  }

  materialTransactions(m:MaterialUsage):InventoryTransactionDto[]{
    return this.inventoryTransactions()
      .filter(tx=>{
        if(Array.isArray(tx.items) && tx.items.length){
          return tx.items.some(line=>line.inventoryItemId===m.inventoryItemId);
        }
        return tx.inventoryItemId===m.inventoryItemId;
      })
      .sort((a,b)=>(Date.parse(b.createdAt)||0)-(Date.parse(a.createdAt)||0));
  }

  materialStockAfter(m:MaterialUsage):number|null{
    const tx=this.materialTransactions(m)[0];
    if(!tx)return null;
    if(Array.isArray(tx.items) && tx.items.length){
      const line=tx.items.find(item=>item.inventoryItemId===m.inventoryItemId);
      return line ? Number(line.afterQty) : null;
    }
    return tx.inventoryItemId===m.inventoryItemId ? Number(tx.afterQty) : null;
  }

  transactionDisplayCode(tx:InventoryTransactionDto):string{
    return tx.transactionCode || tx.groupCode || tx.code || tx.id;
  }

  openInventoryTransactionRow(tx:InventoryTransactionDto):void{
    this.selectedTransactionCode.set(this.transactionDisplayCode(tx));
    this.selectedTransactions.set([tx]);
    this.inventoryDrawerOpen.set(true);
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
    return r.petName || this.appointment()?.petNames?.[0] || r.petId || 'Chưa có dữ liệu';
  }

  petInitial(r:ServiceRecord):string{
    return this.petLabel(r).trim().slice(0,1).toUpperCase() || 'P';
  }

  serviceLabel(r:ServiceRecord):string{
    if(r.serviceName)return r.serviceName;
    const appointment=this.appointment();
    const names=(appointment?.serviceSegments ?? [])
      .filter(segment=>!r.serviceIds.length || r.serviceIds.includes(segment.serviceId))
      .map(segment=>segment.serviceName)
      .filter(Boolean);
    return names.length ? [...new Set(names)].join(' / ') :
      appointment?.serviceNames?.join(' / ') || r.serviceIds.join(', ') || 'Chưa có dữ liệu';
  }

  branchLabel(r:ServiceRecord):string{
    return r.branchName || this.inventoryBranches().find(row=>row.id===r.branchId)?.name ||
      this.appointment()?.branchName || r.branchId || 'Chưa có dữ liệu';
  }

  staffLabel(r:ServiceRecord):string{
    if(r.primaryStaff)return r.primaryRole ? r.primaryStaff+' · '+r.primaryRole : r.primaryStaff;
    const names=r.assignedStaffIds.map(id=>{
      const staff=this.staffDirectory.staff().find(row=>row.id===id || row.userId===id);
      return staff ? displayStaffName(staff) : '';
    }).filter(Boolean);
    return names.length ? names.join(' / ') : r.assignedStaffIds.join(', ') || 'Chưa có dữ liệu';
  }

  reviewerLabel(r:ServiceRecord):string{
    const id=r.reviewerStaffId || r.reviewedBy;
    if(!id)return 'Chưa được chỉ định';
    const staff=this.staffDirectory.staff().find(row=>row.id===id || row.userId===id);
    return staff ? displayStaffName(staff) : id;
  }

  recordNote(r:ServiceRecord):string{
    return r.note || r.professional?.result || r.professional?.professionalNote || 'Chưa có kết quả hoặc ghi chú.';
  }

  reviewLabel(r:ServiceRecord):string{
    if(r.status==='WAITING_VET_REVIEW')return 'Chờ Bác sĩ duyệt';
    if(r.status==='COMPLETED')return 'Đã chốt';
    if(r.reviewerStaffId)return 'Đã chỉ định Bác sĩ';
    return 'Chưa gửi duyệt';
  }

  statusTone(r:ServiceRecord):string{
    return r.status==='COMPLETED'?'success':r.status==='WAITING_VET_REVIEW'?'warning':
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
    const r=this.item();
    if(!r||!this.canEditMaterials())return;
    if(r.status==='REOPENED'){
      this.materialEditorMode.set('correct');
      const actual=r.materials.filter(item=>item.actualQuantity!=='').map(item=>({
        inventoryItemId:item.inventoryItemId,
        quantity:Number(item.actualQuantity),
        unit:item.unit||this.inventoryItems().find(v=>v.id===item.inventoryItemId)?.unit||'',
        notes:item.note,
      }));
      this.materialDrafts.set(actual.length?actual:[{inventoryItemId:'',quantity:0,unit:'',notes:''}]);
    }else{
      this.materialEditorMode.set('add');
      this.materialDrafts.set([{inventoryItemId:'',quantity:1,unit:'',notes:''}]);
    }
    this.dialogError.set('');this.dialog.set('materials');
  }

  addMaterial():void{
    if(this.materialEditorMode()==='add'){
      if(this.materialDrafts().length)return;
      this.materialDrafts.set([{inventoryItemId:'',quantity:1,unit:'',notes:''}]);
      return;
    }
    this.materialDrafts.update(rows=>[...rows,{inventoryItemId:'',quantity:0,unit:'',notes:''}]);
  }

  removeMaterial(index:number):void{
    this.materialDrafts.update(rows=>rows.filter((_,i)=>i!==index));
  }

  adjustMaterialQuantity(index:number,delta:number):void{
    this.materialDrafts.update(rows=>rows.map((row,i)=>{
      if(i!==index)return row;
      const next=Math.max(1,Number(row.quantity||1)+delta);
      return {...row,quantity:next};
    }));
  }

  selectMaterial(index:number,id:string):void{
    const item=this.inventoryItems().find(v=>v.id===id);
    this.materialDrafts.update(rows=>rows.map((row,i)=>i===index?{
      ...row,inventoryItemId:id,unit:item?.unit||row.unit||'',
    }:row));
  }

  materialUnits():string[]{
    const values=this.materialOptions().map(item=>item.unit).filter(Boolean);
    const current=this.materialDrafts()[0]?.unit;
    if(current)values.push(current);
    return [...new Set(values)];
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
    const r=this.item();if(!r||this.busy()||!this.canEditMaterials())return;

    if(this.materialEditorMode()==='correct'){
      const rows=this.materialDrafts();
      if(!rows.length){
        this.dialogError.set('Cần ít nhất một dòng vật tư để lưu hiệu chỉnh.');return;
      }
      if(rows.some(row=>!row.inventoryItemId || row.quantity===null || !Number.isFinite(row.quantity) || row.quantity<0)){
        this.dialogError.set('Chọn vật tư và nhập số lượng từ 0 trở lên cho tất cả các dòng.');return;
      }
      const ids=rows.map(row=>row.inventoryItemId);
      if(new Set(ids).size!==ids.length){
        this.dialogError.set('Mỗi vật tư chỉ được xuất hiện một lần.');return;
      }
      if(rows.some(row=>!this.materialOptions().some(item=>item.id===row.inventoryItemId))){
        this.dialogError.set('Có vật tư không thuộc kho chi nhánh hoặc không còn hoạt động.');return;
      }
      const previousById=new Map(r.materials.map(item=>[item.inventoryItemId,item]));
      const materials=rows.map(row=>({
        inventoryItemId:row.inventoryItemId,
        quantity:row.quantity,
        unit:row.unit||undefined,
        notes:row.notes||undefined,
        isExtra:previousById.get(row.inventoryItemId)?.isExtra ?? true,
      }));
      this.busy.set(true);this.dialogError.set('');
      this.api.put<unknown>('/service-records/'+encodeURIComponent(r.id)+'/materials',{
        expectedVersion:r.version??undefined,materials,
      }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next:raw=>this.acceptMutation(raw,'Đã cập nhật vật liệu thực tế.'),
        error:err=>this.failDialog(err,'Không cập nhật được vật liệu thực tế.'),
      });
      return;
    }

    const row=this.materialDrafts()[0];
    if(!row?.inventoryItemId){
      this.dialogError.set('Vui lòng chọn vật tư hợp lệ.');return;
    }
    if(row.quantity===null || !Number.isFinite(row.quantity) || row.quantity<=0){
      this.dialogError.set('Số lượng vật tư phát sinh phải lớn hơn 0.');return;
    }
    if(!this.materialOptions().some(item=>item.id===row.inventoryItemId)){
      this.dialogError.set('Vật tư không thuộc kho của chi nhánh này hoặc không còn hoạt động.');return;
    }
    if(r.materials.some(item=>item.inventoryItemId===row.inventoryItemId)){
      this.dialogError.set('Vật tư này đã có trong hồ sơ. Chỉ thêm vật tư phát sinh chưa được ghi nhận.');return;
    }

    const existing=r.materials
      .filter(item=>item.actualQuantity!=='')
      .map(item=>({
        inventoryItemId:item.inventoryItemId,
        quantity:Number(item.actualQuantity),
        unit:item.unit||undefined,
        notes:item.note||undefined,
        isExtra:item.isExtra,
      }));
    const materials=[...existing,{
      inventoryItemId:row.inventoryItemId,
      quantity:row.quantity,
      unit:row.unit||undefined,
      notes:row.notes||undefined,
      isExtra:true,
    }];

    this.busy.set(true);this.dialogError.set('');
    this.api.put<unknown>('/service-records/'+encodeURIComponent(r.id)+'/materials',{
      expectedVersion:r.version??undefined,
      materials,
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:raw=>this.acceptMutation(raw,'Đã thêm vật liệu phát sinh.'),
      error:err=>this.failDialog(err,'Không thêm được vật liệu phát sinh.'),
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
    },{headers:this.idempotencyHeaders('submit-review:'+r.id+':'+(r.version??0))}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
    },{headers:this.idempotencyHeaders('finalize:'+r.id+':'+(r.version??0)+':'+reason.trim())}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
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
    },{headers:this.idempotencyHeaders('reopen:'+r.id+':'+(r.version??0)+':'+this.reopenReason().trim())}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:raw=>this.acceptMutation(raw,'Đã mở lại hồ sơ dịch vụ.'),
      error:err=>this.failDialog(err,'Không thể mở lại hồ sơ.'),
    });
  }

  openInventoryTransaction(code:string):void{
    if(!code)return;
    const tx=this.inventoryTransactions().find(row=>
      row.id===code || row.transactionCode===code || row.groupCode===code || row.code===code);
    if(tx){this.openInventoryTransactionRow(tx);return;}
    this.toast.show('Không tìm thấy giao dịch kho liên quan.','info');
  }

  closeInventoryDrawer():void{
    this.inventoryDrawerOpen.set(false);this.selectedTransactions.set([]);this.selectedTransactionCode.set('');
  }

  closeDialog():void{
    if(this.busy())return;
    this.dialog.set(null);this.dialogError.set('');this.materialEditorMode.set('add');
  }

  private acceptMutation(raw:unknown,message:string):void{
    try{
      const updated=normalizeServiceRecordDetail(raw);
      this.item.set(updated);
      this.loadInventoryForRecord(updated,this.requestVersion);
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

  private idempotencyHeaders(fingerprint:string):HttpHeaders{
    let key=this.mutationKeys.get(fingerprint);
    if(!key){
      key=typeof crypto!=='undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : 'sr-'+Date.now()+'-'+Math.random().toString(36).slice(2);
      this.mutationKeys.set(fingerprint,key);
    }
    return new HttpHeaders({'Idempotency-Key':key});
  }
}
