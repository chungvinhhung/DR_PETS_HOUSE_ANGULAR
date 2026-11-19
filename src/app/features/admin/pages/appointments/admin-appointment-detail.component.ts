import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { HttpHeaders, HttpParams } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, Observable } from 'rxjs';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ApiClientService } from '../../../../core/services/api-client.service';
import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminBreadcrumbComponent } from '../../../../shared/admin-breadcrumb/admin-breadcrumb.component';
import { AdminDataStateComponent } from '../../../../shared/admin-data-state/admin-data-state.component';
import { AdminToastService, adminErrorMessage } from '../../../../shared/services/admin-toast.service';
import { CatalogBranch, CatalogService } from '../../service-catalog/models/service-catalog.model';
import { ServiceCatalogApiService } from '../../service-catalog/services/service-catalog-api.service';
import { AdminStaffApiService } from '../../staff/services/admin-staff-api.service';
import {
  AppointmentView, appointmentWindow, normalizeAppointmentDetail, statusLabel,
} from './admin-appointment-workflow.model';
import { ServiceRecord, normalizeServiceRecordsPage, serviceRecordStatusLabel } from './admin-service-record.model';

type DialogAction = 'cancel' | 'reschedule' | 'status' | 'check-in' | 'no-show' | null;

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
  private readonly staffDirectory = inject(AdminStaffApiService);
  private readonly catalog = inject(ServiceCatalogApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);
  private requestVersion = 0;
  private readonly mutationKeys=new Map<string,string>();
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
  readonly rescheduleSlots = signal<{id:string;label:string;status:'AVAILABLE'|'FULL'|'BLOCKED';available:boolean}[]>([]);
  readonly rescheduleSlotId = signal('');
  readonly rescheduleLoading = signal(false);
  readonly rescheduleSlotsState = signal<'idle'|'loading'|'ready'|'empty'|'error'>('idle');
  readonly rescheduleLoadError = signal('');
  readonly actionError = signal('');
  readonly actionBusy = signal(false);
  readonly statusTarget = signal('');
  readonly isManagerOrAdmin = computed(() => this.session.hasAnyRole(['ADMIN','MANAGER']));
  readonly isReceptionist = computed(() => this.session.user()?.systemRole === 'STAFF' &&
    this.session.user()?.staffSubRole === 'RECEPTIONIST');
  readonly isExecutionStaff = computed(() => this.session.user()?.systemRole === 'STAFF' &&
    ['CARE_STAFF_GROOMER','VETERINARIAN','NURSE'].includes(this.session.user()?.staffSubRole ?? ''));
  readonly canManageAppointment = computed(() => this.isManagerOrAdmin() || this.isReceptionist());
  /**
   * BE RBAC B3: /appointments/:id/start is exclusive to the assigned clinical
   * StaffProfile, with the matching requiredStaffRole. Admin, Manager and
   * Receptionist must never be allowed through the UI entry point.
   */
  readonly startableSegment = computed(() => {
    const user = this.session.user();
    const appointment = this.item();
    if (!appointment || !user || !this.isExecutionStaff()) return null;
    if (!this.canAccessAppointmentBranch(appointment.branchId)) return null;
    // Missing/empty live branch scope is fail-closed, matching BE Edge-4 (403).
    if (!(user.branchScope ?? []).includes(appointment.branchId)) return null;
    const ownProfile = this.staffDirectory.staff().find(staff => staff.userId === user.id);
    // A loaded, inactive profile or one outside this branch must not be offered /start.
    if (ownProfile && (ownProfile.accountStatus === 'BLOCKED' ||
      (ownProfile.branchIds?.length && !ownProfile.branchIds.includes(appointment.branchId)))) return null;
    // BE accepts either User ID or StaffProfile ID as an assignment.
    const ownIds = [user.id, ownProfile?.id].filter((id): id is string => !!id);
    const segments = [...appointment.serviceSegments].sort((a,b) => a.sequence - b.sequence);
    const next = segments.find(segment => segment.executionStatus.toUpperCase() !== 'COMPLETED');
    if (!next || next.executionStatus.toUpperCase() !== 'NOT_STARTED') return null;
    return !!next.assignedStaffId && ownIds.includes(next.assignedStaffId) &&
      next.requiredStaffRole === user.staffSubRole ? next : null;
  });
  readonly checkInSupported = computed(() => this.item()?.checkInStatus != null);
  readonly canCheckIn = computed(() => {
    const item = this.item();
    return !!item && this.checkInSupported() && item.checkInStatus !== 'ARRIVED'
      && item.status === 'CONFIRMED'
      && this.canManageAppointment() && this.canAccessAppointmentBranch(item.branchId);
  });
  readonly canStartService = computed(() =>
    this.startableSegment() !== null && this.item()?.checkInStatus === 'ARRIVED' &&
    (this.item()?.status === 'CONFIRMED' || this.item()?.status === 'IN_PROGRESS'));
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
        this.dialog()==='no-show' ? name.includes('no_show') || name.includes('noshow') :
        name.includes('status') || name.includes('confirm') || name.includes('start');
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
    // Preserve the original Admin contract: names come from BE service records,
    // not from a separately fetched staff roster.
    const names=[...new Set(this.linkedRecords()
      .map(record=>this.recordStaffName(record.primaryStaff))
      .filter(name=>name!=='—'))];
    return names.length?names.join(' / '):'—';
  }
  progressSteps():{key:string;label:string;done:boolean;time:string}[]{
    const a=this.item();
    const reached=(step:string)=>a?this.progressReached(a.status,step):false;
    return [
      {key:'confirmed',label:'Đã xác nhận',done:reached('CONFIRMED'),time:this.historyTime('CONFIRMED')},
      {key:'arrived',label:'Đã đến',done:a?.checkInStatus==='ARRIVED',
        time:a?.checkInStatus==='ARRIVED' ? (a.checkedInAt?this.displayShortTime(a.checkedInAt):'Đã check-in')
          : 'Chưa check-in'},
      {key:'serving',label:'Đang phục vụ',done:reached('IN_PROGRESS'),time:reached('IN_PROGRESS')?this.segmentStartTime():'Chưa bắt đầu'},
      {key:'completed',label:'Hoàn thành',done:reached('COMPLETED'),time:reached('COMPLETED')?this.historyTime('COMPLETED'):'Chưa bắt đầu'},
    ];
  }
  private progressReached(status:AppointmentView['status'],step:string):boolean{
    const rank:Record<string,number>={PENDING_PAYMENT:0,PENDING:0,CONFIRMED:1,IN_PROGRESS:3,COMPLETED:4,CANCELLED:0,NO_SHOW:1,UNKNOWN:0};
    const need:Record<string,number>={CONFIRMED:1,ARRIVED:2,IN_PROGRESS:3,COMPLETED:4};
    return (rank[status]??0)>=(need[step]??99);
  }
  private segmentStartTime():string{
    const started=this.item()?.serviceSegments
      .map(segment=>segment.executionStartedAt)
      .filter((value):value is string=>!!value)
      .sort((a,b)=>Date.parse(b)-Date.parse(a))[0];
    return started?this.displayShortTime(started):this.historyTime('IN_PROGRESS');
  }
  private historyTime(status:string):string{
    const event=this.item()?.history.find(row=>row.status.toUpperCase().includes(status));
    return event?.at?this.displayShortTime(event.at):'Chưa bắt đầu';
  }
  private displayShortTime(value:string):string{
    const d=new Date(value);if(Number.isNaN(d.getTime()))return '—';
    return new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}).format(d).replace(',',' ·');
  }
  /**
   * A display-only safeguard for the existing BE service-record name.
   * Do not resolve or infer an employee from assignedStaffId.
   */
  private recordStaffName(value:string|undefined|null):string{
    const name=value?.trim()||'';
    if(!name || /^[0-9a-f]{24}$/i.test(name) ||
       /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(name))return '—';
    return name;
  }
  appointmentRows():{key:string;pet:string;species:string;service:string;staff:string;health:string;note:string;checkIn:string;execution:string;recordId:string}[]{
    const a=this.item();if(!a)return[];
    const segments=a.serviceSegments.length?a.serviceSegments:[];
    if(!segments.length){
      return [{
        key:'appointment-'+a.id,
        pet:a.petNames[0]||'—',species:a.petSpecies||'—',service:a.serviceNames[0]||'—',
        staff:this.recordStaffName(this.linkedRecords()[0]?.primaryStaff),health:a.petHealth||'—',note:a.petNote||'—',
        checkIn:this.checkInLabel(),execution:a.status==='COMPLETED'?'Hoàn thành':a.status==='IN_PROGRESS'?'Đang thực hiện':'Chưa bắt đầu',
        recordId:this.linkedRecords()[0]?.id||'',
      }];
    }
    return segments.map((segment,i)=>{
      const record=this.linkedRecords().find(row=>row.serviceIds.includes(segment.serviceId)) ??
        (this.linkedRecords().length===1 ? this.linkedRecords()[0] : undefined);
      const execution=segment.executionStatus.toUpperCase()==='COMPLETED'?'Hoàn thành':
        segment.executionStatus.toUpperCase()==='IN_PROGRESS'?'Đang thực hiện':'Chưa bắt đầu';
      return {
        key:segment.serviceId+'-'+i,
        pet:record?.petName||a.petNames[0]||'—',
        species:a.petSpecies||'—',
        service:segment.serviceName||record?.serviceName||'—',
        staff:this.recordStaffName(record?.primaryStaff),
        health:a.petHealth||'—',
        note:a.petNote||'—',
        checkIn:this.checkInLabel(),
        execution,
        recordId:record?.id||'',
      };
    });
  }
  paymentMethodLabel(value:string):string{
    const key=value.toUpperCase();return key.includes('STORE')?'Tại phòng khám':key.includes('ONLINE')?'Trực tuyến':value||'—';
  }
  checkInLabel():string {
    const state = this.item()?.checkInStatus;
    return state === 'ARRIVED' ? 'Đã đến' : state ? 'Chưa check-in' : 'Chưa có dữ liệu';
  }
  paymentStatusLabel(value:string):string{
    // Display-only translation. Never alter the BE payment status or amount.
    const key=value.trim().toUpperCase();
    if(['PAID','COMPLETED','SETTLED'].includes(key))return 'Đã thanh toán';
    if(['PARTIAL','PARTIALLY_PAID'].includes(key))return 'Đã thanh toán một phần';
    if(['UNPAID','NOT_PAID'].includes(key))return 'Chưa thanh toán';
    if(['PENDING','PENDING_PAYMENT'].includes(key))return 'Đang chờ thanh toán';
    if(key==='FAILED')return 'Thanh toán thất bại';
    if(key==='REFUNDED')return 'Đã hoàn tiền';
    if(key==='CANCELLED' || key==='CANCELED')return 'Đã hủy thanh toán';
    return value||'Chưa xác định';
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
    if (this.isExecutionStaff()) this.staffDirectory.loadRoster();
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
            if (parsed.id !== id) throw new Error('Dữ liệu lịch hẹn không khớp yêu cầu.');
            if (!this.canAccessAppointmentBranch(parsed.branchId)) {
              this.error.set('Bạn không có quyền xem lịch hẹn của chi nhánh này.');
              this.loading.set(false);
              return;
            }
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

  private canAccessAppointmentBranch(branchId:string):boolean{
    const user=this.session.user();
    if(!user || user.systemRole==='ADMIN')return true;
    if(user.systemRole==='MANAGER' || (user.systemRole==='STAFF' && user.staffSubRole==='RECEPTIONIST')){
      return (user.branchScope ?? []).includes(branchId);
    }
    return true;
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
        this.recordsError.set(adminErrorMessage(err,'Không thể tải hồ sơ dịch vụ liên quan.'));
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
    this.rescheduleLoading.set(true);this.rescheduleLoadError.set('');this.rescheduleSlotsState.set('loading');
    const params=new HttpParams().set('date',date).set('branchId',branchId)
      .set('serviceIds',serviceIds.join(',')).set('includeFull','true');
    this.api.get<unknown>('/availability',{params}).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next:wire=>{
        const root=this.objectValue(wire);
        const payload=this.objectValue(root?.['DT']??root?.['data']??wire);
        const raw=payload?.['slots'];
        if(!Array.isArray(raw)){
          this.rescheduleSlots.set([]);this.rescheduleLoading.set(false);
          this.rescheduleSlotsState.set('error');
          this.rescheduleLoadError.set('Không đọc được dữ liệu khung giờ từ máy chủ.');
          return;
        }
        const slots=raw.map(value=>{
          const row=this.objectValue(value);if(!row)return null;
          const id=String(row['start']??'');
          const end=String(row['end']??'');
          if(!id||!end)return null;
          const remaining=Number(row['remaining']);
          const rawStatus=String(row['status']??'').trim().toUpperCase();
          const available=rawStatus==='AVAILABLE'&&Number.isFinite(remaining)&&remaining>0;
          const status:'AVAILABLE'|'FULL'|'BLOCKED'=rawStatus==='BLOCKED'?'BLOCKED':available?'AVAILABLE':'FULL';
          const label=this.clockLabel(id)+' - '+this.clockLabel(end);
          return {id,label,status,available};
        }).filter((row):row is {id:string;label:string;status:'AVAILABLE'|'FULL'|'BLOCKED';available:boolean}=>!!row);
        this.rescheduleSlots.set(slots);
        this.rescheduleLoading.set(false);
        this.rescheduleSlotsState.set(slots.length?'ready':'empty');
      },
      error:err=>{
        this.rescheduleSlots.set([]);this.rescheduleLoading.set(false);
        this.rescheduleSlotsState.set('error');
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
    const allowed = action === 'status' ? this.canStartService()
      : action === 'check-in' ? this.canCheckIn() : this.canManageAppointment();
    if (!allowed)return;
    this.nowMs.set(Date.now());
    this.dialog.set(action);
    this.reason.set('');
    this.targetDate.set('');
    this.targetTime.set('');
    this.rescheduleSlotId.set('');
    this.rescheduleSlots.set([]);
    this.rescheduleLoadError.set('');
    this.statusTarget.set(action==='status' ? 'IN_PROGRESS' : action==='no-show' ? 'NO_SHOW' : '');
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
    if (!this.canAccessAppointmentBranch(appointment.branchId)) {
      this.showActionMessage('Bạn không có quyền thao tác trên lịch hẹn của chi nhánh này.');
      return;
    }
    const allowed = action === 'status' ? this.canStartService()
      : action === 'check-in' ? this.canCheckIn() : this.canManageAppointment();
    if (!allowed) {this.showActionMessage('Bạn không có quyền thực hiện thao tác này.');return;}

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
    if (action!=='status' && action!=='check-in' && !this.reason().trim()) {this.showActionMessage('Vui lòng nhập lý do xử lý.');return;}

    const fingerprint=[
      action,appointment.id,String(appointment.version),
      this.rescheduleSlotId(),this.reason().trim(),
    ].join('|');
    const headers=this.idempotencyHeaders(fingerprint);
    let request: Observable<unknown>;
    if(action==='cancel'){
      const override=win?.overrideRequiresAudit===true&&this.isManagerOrAdmin();
      request=override
        ? this.api.post<unknown,object>('/appointments/'+encodeURIComponent(appointment.id)+'/cancel-override',
            {reason:this.reason().trim()},{headers})
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
    }else if(action==='check-in'){
      request=this.api.post<unknown,{note:string}>(
        '/appointments/'+encodeURIComponent(appointment.id)+'/check-in',
        {note:'Khách đã đến chi nhánh'});
    }else if(action==='no-show'){
      if(!appointment.noShowWarning){
        this.showActionMessage('Lịch hẹn chưa đủ điều kiện đánh dấu Không đến.');return;
      }
      request=this.api.post<unknown,{reason:string}>(
        '/appointments/'+encodeURIComponent(appointment.id)+'/no-show',
        {reason:this.reason().trim()},
        {headers},
      );
    }else{
      if(!this.checkInSupported()){
        this.showActionMessage('Chưa thể bắt đầu dịch vụ vì hệ thống chưa có dữ liệu check-in theo từng thú cưng.');
        return;
      }
      const segment = this.startableSegment();
      if (!segment) {
        this.showActionMessage('Chỉ nhân viên chuyên môn được phân công đúng vai trò mới được bắt đầu dịch vụ.');
        return;
      }
      if (!/^[0-9a-f]{24}$/i.test(segment.serviceId)) {
        this.showActionMessage('Mã dịch vụ không hợp lệ. Vui lòng tải lại lịch hẹn để kiểm tra phân công.'); return;
      }
      const startBody: {serviceId:string;expectedVersion?:number} = { serviceId:segment.serviceId };
      if (Number.isSafeInteger(appointment.version) && appointment.version >= 1) {
        startBody.expectedVersion = appointment.version;
      }
      request=this.api.post<unknown,typeof startBody>(
        '/appointments/'+encodeURIComponent(appointment.id)+'/start',
        startBody,{headers});
    }

    this.actionBusy.set(true);
    this.actionError.set('');
    request.pipe(
      finalize(()=>this.actionBusy.set(false)),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next:()=>{
        this.toast.show(action==='cancel'?'Đã hủy lịch hẹn.':
          action==='reschedule'?'Đã đổi lịch hẹn.':
          action==='no-show'?'Đã đánh dấu khách không đến.':
          action==='check-in'?'Đã check-in lịch hẹn.':'Đã bắt đầu phục vụ.','success');
        this.closeDialog();
        this.refresh();
      },
      error:err=>{
        const message=adminErrorMessage(err,
          action==='cancel'?'Không thể hủy lịch hẹn.':
          action==='reschedule'?'Không thể đổi lịch hẹn.':
          action==='no-show'?'Không thể đánh dấu khách không đến.':
          action==='check-in'?'Không thể check-in lịch hẹn.':'Không thể bắt đầu phục vụ.');
        this.actionError.set(message);
        this.toast.show(message,'error');
        // BE rejects stale versions, changed assignments, and invalid transitions
        // without side effects; refetch current appointment before another attempt.
        if (['status','check-in'].includes(action) &&
          [409,422].includes(Number(err?.status))) this.refresh();
      }
    });
  }
  private idempotencyHeaders(fingerprint:string):HttpHeaders {
    let key=this.mutationKeys.get(fingerprint);
    if(!key){
      key=typeof crypto!=='undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : 'appointment-'+Date.now()+'-'+Math.random().toString(36).slice(2);
      this.mutationKeys.set(fingerprint,key);
    }
    return new HttpHeaders({'Idempotency-Key':key});
  }
}
