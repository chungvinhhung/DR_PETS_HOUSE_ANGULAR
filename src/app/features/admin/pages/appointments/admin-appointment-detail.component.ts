import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { HttpHeaders, HttpParams } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ApiClientService } from '../../../../core/services/api-client.service';
import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminBreadcrumbComponent } from '../../../../shared/admin-breadcrumb/admin-breadcrumb.component';
import { AdminDataStateComponent } from '../../../../shared/admin-data-state/admin-data-state.component';
import { AdminToastService, adminErrorMessage } from '../../../../shared/services/admin-toast.service';
import { CatalogBranch, CatalogService } from '../../service-catalog/models/service-catalog.model';
import { ServiceCatalogApiService } from '../../service-catalog/services/service-catalog-api.service';
import {
  AppointmentView, appointmentWindow, normalizeAppointmentDetail, statusLabel,
} from './admin-appointment-workflow.model';
import { ServiceRecord, normalizeServiceRecordsPage, serviceRecordStatusLabel } from './admin-service-record.model';

type DialogAction = 'cancel' | 'reschedule' | 'status' | null;

@Component({
  selector: 'app-admin-appointment-detail',
  standalone: true,
  imports: [RouterLink, AdminCatalogShellComponent, AdminBreadcrumbComponent, AdminDataStateComponent],
  templateUrl: './admin-appointment-detail.component.html',
  styleUrl: './admin-appointment-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAppointmentDetailComponent {
  private readonly api = inject(ApiClientService);
  private readonly toast = inject(AdminToastService);
  private readonly session = inject(AuthSessionService);
  private readonly catalog = inject(ServiceCatalogApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private requestVersion = 0;
  private readonly nowMs = signal(Date.now());

  readonly id = signal(this.route.snapshot.paramMap.get('id') || '');
  readonly loading = signal(false);
  readonly error = signal('');
  readonly item = signal<AppointmentView | null>(null);
  readonly linkedRecords=signal<ServiceRecord[]>([]);
  readonly recordsLoading=signal(false);
  readonly recordsError=signal('');
  readonly serviceRecordStatusLabel=serviceRecordStatusLabel;
  readonly dialog = signal<DialogAction>(null);
  readonly reason = signal('');
  readonly targetDate = signal('');
  readonly targetTime = signal('');
  readonly rescheduleBranchId = signal('');
  readonly rescheduleServiceId = signal('');
  readonly rescheduleBranches = signal<CatalogBranch[]>([]);
  readonly rescheduleServices = signal<CatalogService[]>([]);
  readonly rescheduleSlots = signal<{id:string;label:string;available:boolean}[]>([]);
  readonly rescheduleSlotId = signal('');
  readonly rescheduleLoading = signal(false);
  readonly rescheduleLoadError = signal('');
  readonly actionError = signal('');
  readonly actionBusy = signal(false);
  readonly statusTarget = signal('');
  readonly isManagerOrAdmin = computed(() => this.session.hasAnyRole(['ADMIN','MANAGER']));
  readonly isReceptionist = computed(() => this.session.user()?.systemRole === 'STAFF' &&
    this.session.user()?.staffSubRole === 'RECEPTIONIST');
  readonly canInspectActions = computed(() => this.isManagerOrAdmin() || this.isReceptionist());
  readonly cancellationWindow = computed(() => {
    const a = this.item();
    return a ? appointmentWindow(a,'cancel',this.nowMs(),this.isManagerOrAdmin()) : null;
  });
  readonly rescheduleWindow = computed(() => {
    const a = this.item();
    return a ? appointmentWindow(a,'reschedule',this.nowMs(),this.isManagerOrAdmin()) : null;
  });
  readonly proposedActions = computed(() => {
    const item = this.item();
    if (!item || ['COMPLETED','CANCELLED','NO_SHOW','PENDING_PAYMENT'].includes(item.status)) return [];
    if (item.status === 'CONFIRMED') return ['IN_PROGRESS','NO_SHOW','CANCELLED'];
    // IN_PROGRESS is completed by the service-record workflow, not manually by Receptionist.
    return [];
  });
  readonly sourceActionIsAllowed = computed(() => {
    const item=this.item();
    if (!item || !this.dialog()) return false;
    const actions = item.allowedActions;
    if (!actions) return false;
    return actions.some(action => {
      const name=action.toLowerCase();
      return this.dialog()==='cancel' ? name.includes('cancel') :
        this.dialog()==='reschedule' ? name.includes('reschedul') :
        name.includes('status') || name.includes('confirm') || name.includes('start') || name.includes('no_show') || name.includes('noshow');
    });
  });

  displayCode(value:string):string{return value.replace(/^#/,'');}
  displayAppointmentWindow(appointment:AppointmentView):string{
    if(!appointment.appointmentAt)return '—';
    const start=new Date(appointment.appointmentAt);
    if(Number.isNaN(start.getTime()))return this.displayTime(appointment.appointmentAt);
    const date=new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric'}).format(start);
    const from=new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',hour12:false}).format(start);
    return date+' · '+from;
  }
  assignedStaffSummary():string{
    const rows=this.linkedRecords();
    const names=[...new Set(rows.map(r=>r.primaryStaff).filter(Boolean))];
    return names.length?names.join(' / '):'—';
  }
  progressSteps():{key:string;label:string;done:boolean;time:string}[]{
    const a=this.item();
    const reached=(step:string)=>a?this.progressReached(a.status,step):false;
    return [
      {key:'confirmed',label:'Đã xác nhận',done:reached('CONFIRMED'),time:this.historyTime('CONFIRMED')},
      {key:'arrived',label:'Đã đến',done:reached('ARRIVED'),time:reached('ARRIVED')?this.historyTime('IN_PROGRESS'):'Chưa bắt đầu'},
      {key:'serving',label:'Đang phục vụ',done:reached('IN_PROGRESS'),time:reached('IN_PROGRESS')?this.historyTime('IN_PROGRESS'):'Chưa bắt đầu'},
      {key:'completed',label:'Hoàn thành',done:reached('COMPLETED'),time:reached('COMPLETED')?this.historyTime('COMPLETED'):'Chưa bắt đầu'},
    ];
  }
  private progressReached(status:AppointmentView['status'],step:string):boolean{
    const rank:Record<string,number>={PENDING_PAYMENT:0,PENDING:0,CONFIRMED:1,IN_PROGRESS:3,COMPLETED:4,CANCELLED:0,NO_SHOW:1,UNKNOWN:0};
    const need:Record<string,number>={CONFIRMED:1,ARRIVED:2,IN_PROGRESS:3,COMPLETED:4};
    return (rank[status]??0)>=(need[step]??99);
  }
  private historyTime(status:string):string{
    const event=this.item()?.history.find(row=>row.status.toUpperCase().includes(status));
    return event?.at?this.displayShortTime(event.at):'Chưa bắt đầu';
  }
  private displayShortTime(value:string):string{
    const d=new Date(value);if(Number.isNaN(d.getTime()))return '—';
    return new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d).replace(',',' ·');
  }
  appointmentRows():{key:string;pet:string;species:string;service:string;staff:string;health:string;note:string;checkedIn:boolean;execution:string;recordId:string}[]{
    const a=this.item();if(!a)return[];
    const count=Math.max(1,a.petNames.length,a.serviceNames.length,this.linkedRecords().length);
    return Array.from({length:count},(_,i)=>{
      const record=this.linkedRecords()[i];
      return {
        key:(record?.id||'row')+'-'+i,
        pet:a.petNames[i]||record?.petName||a.petNames[0]||'—',
        species:'—',
        service:a.serviceNames[i]||record?.serviceName||a.serviceNames[0]||'—',
        staff:record?.primaryStaff||'—',
        health:'—',
        note:'—',
        checkedIn:['IN_PROGRESS','COMPLETED'].includes(a.status),
        execution:record?this.serviceRecordStatusLabel(record.status,record.rawStatus):(a.status==='COMPLETED'?'Hoàn thành':a.status==='IN_PROGRESS'?'Đang thực hiện':'Chưa bắt đầu'),
        recordId:record?.id||'',
      };
    });
  }
  paymentMethodLabel(value:string):string{
    const key=value.toUpperCase();return key.includes('STORE')?'Tại phòng khám':key.includes('ONLINE')?'Trực tuyến':value||'—';
  }
  paymentStatusLabel(value:string):string{
    const key=value.toUpperCase();return ['PAID','COMPLETED','SETTLED'].includes(key)?'Đã thanh toán':value||'Đang chờ thanh toán';
  }
  historyLabel(value:string):string{
    const key=value.toUpperCase();
    if(key.includes('COMPLETED'))return 'Hoàn thành tất cả dịch vụ';
    if(key.includes('IN_PROGRESS')||key.includes('PROCESSING'))return 'Bắt đầu thực hiện dịch vụ';
    if(key.includes('CONFIRMED')||key.includes('PENDING_CONFIRMATION'))return 'Đã xác nhận';
    if(key.includes('CREATE')||key.includes('PENDING'))return 'Tạo lịch hẹn';
    if(key.includes('CANCEL'))return 'Đã hủy';
    if(key.includes('NO_SHOW'))return 'Không đến';
    return value;
  }

  constructor() {
    this.loadRescheduleBranches();
    this.refresh();
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      const id = params.get('id') || '';
      if (id && id !== this.id()) {
        this.id.set(id);
        this.closeDialog();
        this.refresh();
      }
    });
    // Direct "delete" icon from Figma must route to a cancellation request, never hard-delete.
    this.route.queryParamMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe(params => {
      if (params.get('action') === 'cancel') this.dialog.set('cancel');
    });
  }

  refresh(): void {
    const id = this.id();
    if (!id) { this.error.set('Thiếu mã định danh lịch hẹn.'); return; }
    const version=++this.requestVersion;
    this.loading.set(true);this.error.set('');this.item.set(null);
    this.linkedRecords.set([]);this.recordsError.set('');
    // Confirmed read-only GET detail on BE /appointments/:id. Never bypass BE scope checks.
    this.api.get<unknown>('/appointments/' + encodeURIComponent(id))
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next: response => {
          if (version!==this.requestVersion)return;
          try {
            const parsed=normalizeAppointmentDetail(response);
            if (parsed.id !== id) throw new Error('API trả về lịch hẹn không khớp mã được yêu cầu.');
            this.item.set(parsed);this.loading.set(false);
            this.loadLinkedRecords(id,version);
          } catch (err) {
            this.error.set(err instanceof Error ? err.message : 'Không đọc được chi tiết lịch hẹn.');
            this.loading.set(false);
          }
        },
        error: err => {
          if (version!==this.requestVersion)return;
          this.error.set(adminErrorMessage(err,'Không thể tải chi tiết lịch hẹn. Vui lòng thử lại.'));
          this.loading.set(false);
        },
      });
  }

  private loadLinkedRecords(appointmentId:string,version:number):void{
    this.recordsLoading.set(true);
    // GET /service-records?appointmentId is supported in BE foundation-v6.
    const params=new HttpParams().set('appointmentId',appointmentId).set('limit','100');
    this.api.get<unknown>('/service-records',{params}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:response=>{
        if(version!==this.requestVersion)return;
        try{
          this.linkedRecords.set(normalizeServiceRecordsPage(response).items);
          this.recordsError.set('');
        }catch(err){
          this.recordsError.set(err instanceof Error?err.message:'Không đọc được hồ sơ dịch vụ liên quan.');
        }
        this.recordsLoading.set(false);
      },
      error:err=>{
        if(version!==this.requestVersion)return;
        this.recordsError.set(adminErrorMessage(err,'Chưa thể lấy ServiceRecord của lịch hẹn.'));
        this.recordsLoading.set(false);
      }
    });
  }

  private loadRescheduleBranches():void{
    this.catalog.listBranches().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:rows=>this.rescheduleBranches.set(rows),
      error:()=>this.rescheduleBranches.set([]),
    });
  }

  changeRescheduleBranch(_branchId:string):void {
    // Current BE reschedule keeps the original branch.
  }

  changeRescheduleService(_serviceId:string):void {
    // Current BE reschedule keeps the original service sequence.
  }

  changeRescheduleDate(value:string):void{
    this.targetDate.set(value);
    this.rescheduleSlots.set([]);
    this.rescheduleSlotId.set('');
    this.targetTime.set('');
    this.loadRescheduleSlots();
  }

  chooseRescheduleSlot(id:string):void{
    const slot=this.rescheduleSlots().find(row=>row.id===id&&row.available);
    this.rescheduleSlotId.set(slot?.id||'');
    if(!slot){this.targetTime.set('');return;}
    const d=new Date(slot.id);
    this.targetTime.set(Number.isNaN(d.getTime()) ? slot.label.slice(0,5) :
      new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',hour12:false}).format(d));
  }

  private loadRescheduleServices(branchId:string,preferredName:string):void{
    if(!branchId){this.rescheduleServices.set([]);return;}
    this.rescheduleLoading.set(true);this.rescheduleLoadError.set('');
    this.catalog.list({branchId,search:'',mode:'BOOKABLE',status:'ACTIVE',page:1,pageSize:100})
      .pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
        next:result=>{
          const rows=result.items.filter(row=>row.bookingMode==='BOOKABLE'&&row.status==='ACTIVE');
          this.rescheduleServices.set(rows);
          const preferred=rows.find(row=>row.name===preferredName);
          this.rescheduleServiceId.set(preferred?.id||'');
          this.rescheduleLoading.set(false);
          if(preferred&&this.targetDate())this.loadRescheduleSlots();
        },
        error:err=>{
          this.rescheduleServices.set([]);this.rescheduleServiceId.set('');
          this.rescheduleLoading.set(false);
          this.rescheduleLoadError.set(adminErrorMessage(err,'Không tải được dịch vụ tại chi nhánh.'));
        }
      });
  }

  private loadRescheduleSlots():void{
    const item=this.item();
    const branchId=this.rescheduleBranchId(), date=this.targetDate();
    const serviceIds=(item?.serviceSegments ?? []).map(segment=>segment.serviceId).filter(Boolean);
    if(!branchId||!serviceIds.length||!date)return;
    this.rescheduleLoading.set(true);this.rescheduleLoadError.set('');
    const params=new HttpParams().set('date',date).set('branchId',branchId)
      .set('serviceIds',serviceIds.join(',')).set('includeFull','true');
    this.api.get<unknown>('/availability',{params}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:wire=>{
        const root=this.objectValue(wire);
        const payload=this.objectValue(root?.['DT']??root?.['data']??wire);
        const raw=payload?.['slots'];
        const slots=Array.isArray(raw)?raw.map(value=>{
          const row=this.objectValue(value);if(!row)return null;
          const id=String(row['start']??'');
          const end=String(row['end']??'');
          if(!id||!end)return null;
          const remaining=Number(row['remaining']);
          const label=this.clockLabel(id)+' - '+this.clockLabel(end);
          return {id,label,available:String(row['status']??'').toUpperCase()==='AVAILABLE'&&Number.isFinite(remaining)&&remaining>0};
        }).filter((row):row is {id:string;label:string;available:boolean}=>!!row):[];
        this.rescheduleSlots.set(slots);
        this.rescheduleLoading.set(false);
        if(!slots.length)this.rescheduleLoadError.set('Không còn khung giờ phù hợp trong ngày đã chọn.');
      },
      error:err=>{
        this.rescheduleSlots.set([]);this.rescheduleLoading.set(false);
        this.rescheduleLoadError.set(adminErrorMessage(err,'Không tải được khung giờ mới.'));
      }
    });
  }

  private objectValue(value:unknown):Record<string,unknown>|null{
    return value!==null&&typeof value==='object'&&!Array.isArray(value)?value as Record<string,unknown>:null;
  }

  private clockLabel(value:string):string{
    const d=new Date(value);
    if(Number.isNaN(d.getTime()))return value.slice(11,16)||value.slice(0,5);
    return new Intl.DateTimeFormat('en-GB',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',hour12:false}).format(d);
  }

  statusLabel(value: string): string {
    const a=this.item();
    return statusLabel(value as AppointmentView['status'],a?.rawStatus);
  }
  displayTime(value: string | null, withTime = true): string {
    if(!value) return 'Chưa có dữ liệu';
    const date=new Date(value);
    if(Number.isNaN(date.getTime()))return value;
    return new Intl.DateTimeFormat('vi-VN',{
      timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',year:'numeric',
      ...(withTime ? {hour:'2-digit',minute:'2-digit'}:{})
    }).format(date);
  }
  amount(value: number | null): string {
    return value===null ? 'Chưa có dữ liệu' : new Intl.NumberFormat('vi-VN').format(value)+'đ';
  }
  statusBadge(): string {
    const st=this.item()?.status;
    return st==='CANCELLED'||st==='NO_SHOW'?'danger':
      st==='COMPLETED'||st==='CONFIRMED'?'success':(st==='PENDING'||st==='PENDING_PAYMENT')?'warning':'neutral';
  }

  startAction(action: Exclude<DialogAction,null>): void {
    if (!this.canInspectActions())return;
    this.nowMs.set(Date.now());
    this.dialog.set(action);
    this.reason.set('');
    this.targetDate.set('');
    this.targetTime.set('');
    this.rescheduleSlotId.set('');
    this.rescheduleSlots.set([]);
    this.rescheduleLoadError.set('');
    this.statusTarget.set(action==='status' ? (this.proposedActions()[0] || '') : '');
    this.actionError.set('');
    if(action==='reschedule'){
      const item=this.item();
      this.rescheduleBranchId.set(item?.branchId||'');
      if(item?.appointmentAt){
        const d=new Date(item.appointmentAt);
        if(!Number.isNaN(d.getTime())){
          this.targetDate.set(new Intl.DateTimeFormat('en-CA',{
            timeZone:'Asia/Ho_Chi_Minh',year:'numeric',month:'2-digit',day:'2-digit'
          }).format(d));
        }
      }
      const firstService=item?.serviceSegments?.[0];
      this.rescheduleServiceId.set(firstService?.serviceId||'');
      if(this.targetDate()&&firstService?.serviceId)this.loadRescheduleSlots();
    }
  }
  closeDialog(): void {
    this.dialog.set(null);this.reason.set('');this.targetDate.set('');this.targetTime.set('');
    this.rescheduleBranchId.set('');this.rescheduleServiceId.set('');
    this.rescheduleServices.set([]);this.rescheduleSlots.set([]);this.rescheduleSlotId.set('');
    this.rescheduleLoadError.set('');this.rescheduleLoading.set(false);
    this.actionError.set('');this.statusTarget.set('');
  }
  selectedWindow() {
    return this.dialog()==='cancel' ? this.cancellationWindow() :
      this.dialog()==='reschedule' ? this.rescheduleWindow() : null;
  }
  showPolicyMessage(): string {
    const decision=this.selectedWindow();
    if (!decision)return '';
    switch(decision.status) {
      case 'eligible':return 'Lịch hẹn còn từ 24 giờ trở lên. Bạn có thể gửi yêu cầu thay đổi.';
      case 'too-late':return 'Còn dưới 24 giờ. Chỉ Manager/Admin có thể đề nghị override kèm lý do và audit.';
      case 'missing-count':return 'Chưa xác định được số lần đổi lịch. Vui lòng thử lại sau.';
      case 'limit-reached':return 'Đã đạt giới hạn 2 lần đổi lịch. Chỉ Manager/Admin có thể đề nghị override có audit.';
      case 'terminal':return 'Lịch đã kết thúc hoặc không còn được phép thay đổi.';
      case 'missing-time':return 'Thiếu thời gian hẹn thực tế. Không thể tính thời hạn 24 giờ.';
    }
  }
  private showActionMessage(message: string): void {
    this.actionError.set(message);
    this.toast.show(message, 'info');
  }

  inspectRequest(): void {
    const action=this.dialog();
    const appointment=this.item();
    if (!action||!appointment||this.actionBusy())return;
    if (!this.canInspectActions()) {this.showActionMessage('Bạn không có quyền xử lý lịch hẹn.');return;}

    if (action==='reschedule') {
      if (!this.targetDate()||!this.rescheduleSlotId()) {
        this.showActionMessage('Vui lòng chọn ngày hẹn và khung giờ mới.');return;
      }
      if(new Date(this.rescheduleSlotId()).getTime()<=Date.now()) {
        this.showActionMessage('Thời gian mới phải ở tương lai.');return;
      }
    }

    const win=this.selectedWindow();
    if(win && !win.canRequest) {this.showActionMessage(this.showPolicyMessage());return;}
    if (!this.reason().trim()) {this.showActionMessage('Vui lòng nhập lý do xử lý.');return;}

    const headers=new HttpHeaders({'Idempotency-Key':crypto.randomUUID()});
    let request;
    if(action==='cancel'){
      const override=win?.overrideRequiresAudit===true&&this.isManagerOrAdmin();
      request=override
        ? this.api.post<unknown,object>('/appointments/'+encodeURIComponent(appointment.id)+'/cancel-override',
            {reason:this.reason().trim(),prepaidOutcome:'REFUND_PENDING'},{headers})
        : this.api.post<unknown,object>('/appointments/'+encodeURIComponent(appointment.id)+'/store-cancel',
            {reason:this.reason().trim()},{headers});
    }else if(action==='reschedule'){
      const override=win?.overrideRequiresAudit===true&&this.isManagerOrAdmin();
      const body=override
        ? {newSlotStart:this.rescheduleSlotId(),reason:this.reason().trim()}
        : {newSlotStart:this.rescheduleSlotId()};
      request=this.api.post<unknown,typeof body>(
        '/appointments/'+encodeURIComponent(appointment.id)+(override?'/reschedule-override':'/reschedule'),
        body,{headers});
    }else{
      const segment=appointment.serviceSegments.find(row=>
        !['IN_PROGRESS','COMPLETED'].includes(row.executionStatus.toUpperCase()));
      if(!segment){
        this.showActionMessage('Không còn dịch vụ nào có thể bắt đầu.');return;
      }
      request=this.api.post<unknown,{serviceId:string}>(
        '/appointments/'+encodeURIComponent(appointment.id)+'/start',
        {serviceId:segment.serviceId});
    }

    this.actionBusy.set(true);
    this.actionError.set('');
    request.pipe(
      finalize(()=>this.actionBusy.set(false)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next:()=>{
        this.toast.show(action==='cancel'?'Đã hủy lịch hẹn.':
          action==='reschedule'?'Đã đổi lịch hẹn.':'Đã bắt đầu phục vụ.','success');
        this.closeDialog();
        this.refresh();
      },
      error:err=>{
        const message=adminErrorMessage(err,
          action==='cancel'?'Không thể hủy lịch hẹn.':
          action==='reschedule'?'Không thể đổi lịch hẹn.':'Không thể bắt đầu phục vụ.');
        this.actionError.set(message);
        this.toast.show(message,'error');
      }
    });
  }
}
