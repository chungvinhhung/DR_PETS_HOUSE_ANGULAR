import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, signal } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { ApiClientService } from '../../../../core/services/api-client.service';
import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminToastService, adminErrorMessage } from '../../../../shared/services/admin-toast.service';
import {
  AppointmentView, appointmentWindow, normalizeAppointmentDetail, statusLabel,
} from './admin-appointment-workflow.model';
import { ServiceRecord, normalizeServiceRecordsPage, serviceRecordStatusLabel } from './admin-service-record.model';

type DialogAction = 'cancel' | 'reschedule' | 'status' | null;

@Component({
  selector: 'app-admin-appointment-detail',
  standalone: true,
  imports: [RouterLink, AdminCatalogShellComponent],
  templateUrl: './admin-appointment-detail.component.html',
  styleUrl: './admin-appointment-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminAppointmentDetailComponent {
  private readonly api = inject(ApiClientService);
  private readonly toast = inject(AdminToastService);
  private readonly session = inject(AuthSessionService);
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
  readonly actionError = signal('');
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
    this.statusTarget.set('');
    this.actionError.set('');
  }
  closeDialog(): void {
    this.dialog.set(null);this.reason.set('');this.targetDate.set('');this.targetTime.set('');
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
    if (!this.dialog())return;
    if (!this.canInspectActions()) {this.showActionMessage('Bạn không có quyền xử lý lịch hẹn.');return;}
    if (this.dialog()==='status'&&!this.statusTarget())
      {this.showActionMessage('Vui lòng chọn trạng thái muốn cập nhật.');return;}
    if (this.dialog()==='reschedule') {
      if (!this.targetDate()||!this.targetTime()) {
        this.showActionMessage('Vui lòng chọn ngày và giờ hẹn mới.');return;
      }
      if(new Date(this.targetDate()+'T'+this.targetTime()).getTime()<=Date.now()) {
        this.showActionMessage('Thời gian mới phải ở tương lai.');return;
      }
    }
    const win=this.selectedWindow();
    if(win && !win.canRequest) {this.showActionMessage(this.showPolicyMessage());return;}
    if (!this.reason().trim()) {this.showActionMessage('Vui lòng nhập lý do xử lý.');return;}
    // These methods are intentionally not wired to unverified mutation APIs.
    this.showActionMessage('Chức năng này đang được hoàn thiện. Lịch hẹn của bạn chưa thay đổi.');
  }
}
