import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { RouterLink } from '@angular/router';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminDataStateComponent } from '../../../../shared/admin-data-state/admin-data-state.component';
import { AdminStaffWeekNavComponent } from '../components/admin-staff-week-nav.component';
import { formatStaffWeekRange } from '../utils/staff-week-range';
import { AdminStaffApiService, staffTodayISO } from '../services/admin-staff-api.service';
import { JOB_LABELS, JobRole, StaffPreview, displayStaffName } from '../models/staff-preview.model';
import { DayShiftDraft, ShiftOption, StaffShiftAssignmentDialogComponent, overlaps } from '../components/staff-shift-assignment-dialog.component';
import { AdminToastService } from '../../../../shared/services/admin-toast.service';
import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { canAdmin } from '../../../../core/guards/admin-role-policy';

const DAY = 86_400_000;
const mondayOf = (iso: string): string => {
  const day = new Date(iso + 'T00:00:00Z');
  day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7);
  return day.toISOString().slice(0, 10);
};
// Use the browser's LOCAL day rather than UTC, so "Hôm nay" works near midnight.
const todayIso = (): string => {
  const date = new Date();
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
};
const dateFor = (monday: string, offset: number): string =>
  new Date(new Date(monday + 'T00:00:00Z').getTime() + offset * DAY).toISOString().slice(0, 10);
const readable = (iso: string): string => iso.slice(8, 10) + '/' + iso.slice(5, 7);

/** Weekly staff schedule backed by the scoped Staff/Shift APIs. */
@Component({
  selector: 'app-admin-staff-schedule',
  standalone: true,
  imports: [AdminCatalogShellComponent, AdminDataStateComponent, RouterLink, AdminStaffWeekNavComponent, StaffShiftAssignmentDialogComponent],
  templateUrl: './admin-staff-schedule.component.html',
  styleUrl: './admin-staff-schedule.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminStaffScheduleComponent {
  readonly staffApi = inject(AdminStaffApiService);
  private readonly session = inject(AuthSessionService);
  readonly canManageShifts = computed(() => canAdmin(this.session.user(), 'shifts.manage'));
  private readonly toast = inject(AdminToastService);
  readonly monday = signal(mondayOf(staffTodayISO()));
  constructor() {
    this.staffApi.loadRoster();
    effect(() => {
      if (this.staffApi.loaded()) this.staffApi.loadWeek(this.monday());
    });
    effect(() => {
      const branches = this.branches();
      if (branches.length && !branches.some(b=>b.id===this.branch())) this.branch.set(branches[0].id);
    });
  }
  readonly branch = signal('');
  readonly dialog = signal<{employee: StaffPreview; date: string} | null>(null);
  readonly createdOptions = signal<ShiftOption[]>([]);
  readonly showCreateTemplate = signal(false);
  readonly templateName = signal('');
  readonly templateStart = signal('08:00');
  readonly templateEnd = signal('17:00');
  readonly templateError = signal('');
  readonly createSaving = signal(false);
  readonly selectedOptions = computed(() => this.createdOptions());
  readonly role = signal('ALL');
  readonly roles = (Object.entries(JOB_LABELS) as [JobRole, string][]).filter(([role]) => role !== 'UNKNOWN');
  readonly branches = computed(() => {
    const values = this.staffApi.branches();
    if (this.canManageShifts()) return values;
    const scope = new Set((this.session.user()?.branchScope ?? []).map(String));
    return values.filter(b => scope.has(String(b.id)));
  });
  readonly activeBranch = computed(() => this.branches().find(x => x.id === this.branch()));
  readonly days = computed(() => Array.from({ length: 7 }, (_, index) => {
    const iso = dateFor(this.monday(), index);
    return {
      iso,
      weekday: index === 6 ? 'Chủ Nhật' : 'Thứ ' + (index + 2),
      dayMonth: readable(iso),
    };
  }));
  readonly weekLabel = computed(() => formatStaffWeekRange(this.monday()));
  readonly filtered = computed(() => this.staffApi.staff().filter(staff =>
    (this.canManageShifts() || !!staff.userId && String(staff.userId) === String(this.session.user()?.id)) &&
    (this.role() === 'ALL' || staff.jobRole === this.role()) &&
    !!this.branch() && !!staff.branchIds?.includes(this.branch())));
  // The weekly grid displays every matching staff member; Figma has no pagination.
  readonly rows = this.filtered;

  displayName = displayStaffName;
  roleLabel(staff: StaffPreview): string { return JOB_LABELS[staff.jobRole]; }
  shifts(staffId: string, iso: string) {
    return this.staffApi.shifts().filter(shift =>
      shift.staffId === staffId && shift.isoDate === iso &&
      shift.branchId === this.branch()).sort((a,b)=>a.time.localeCompare(b.time));
  }
  selectRole(value: string) { this.role.set(value); }
  selectBranch(value: string) { if (!this.branches().some(b=>b.id===value)) return; this.branch.set(value); this.createdOptions.set([]); }
  changeWeek(delta: number) { this.monday.set(dateFor(this.monday(), delta * 7)); }
  goToday(): void { this.monday.set(mondayOf(todayIso())); }
  retrySchedule(): void {
    if (this.staffApi.error()) this.staffApi.loadRoster(true);
    else this.staffApi.loadWeek(this.monday(), true);
  }

  selectDate(value: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    const parsed = new Date(value + 'T00:00:00Z');
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return;
    this.monday.set(mondayOf(value));
  }
  onCellClick(employee: StaffPreview, date: string): void {
    this.openDay(employee, date);
  }
  openDay(employee: StaffPreview, date: string): void {
    if (!this.canManageShifts()) return;
    if (!this.branch() || this.staffApi.shiftLoading() || !!this.staffApi.shiftError()) return;
    this.dialog.set({employee,date});
  }
  closeDay():void {this.dialog.set(null);this.showCreateTemplate.set(false);}
  forDay():DayShiftDraft[] {
    const dialog=this.dialog();if(!dialog)return [];
    return this.shifts(dialog.employee.id,dialog.date).map((s,i)=>{
      const [start,end]=s.time.split(/[–—-]/).map(v=>v.trim());
      return {id:s.shiftId||'shift-'+i,name:s.shiftName,start,end,shiftId:s.shiftId};
    });
  }
  otherBranches(): ReturnType<typeof this.shifts> {
    const dialog=this.dialog();if(!dialog)return [];
    return this.staffApi.shifts().filter(s=>s.staffId===dialog.employee.id && s.isoDate===dialog.date && s.branchId!==this.branch());
  }
  async checkAssignment(data:{draft:DayShiftDraft[];scope:'day'|'weekly';from:string;to:string}):Promise<void> {
    if (!this.canManageShifts()) return;
    if (data.scope !== 'day') {
      this.toast.show('Phân ca lặp hằng tuần chưa được hệ thống hỗ trợ.', 'info');
      return;
    }
    const existing=this.forDay();
    const desiredIds=new Set(data.draft.map(row=>row.shiftId).filter((id):id is string=>!!id));
    const removed=existing.filter(row=>row.shiftId&&!desiredIds.has(row.shiftId));
    const added=data.draft.filter(row=>!row.shiftId);
    if (added.length) {
      this.toast.show('Để thêm ca mới, dùng “Tạo ca làm việc mới” để lưu trực tiếp và kiểm tra trùng giờ.', 'info');
      return;
    }
    if (!removed.length) {
      this.closeDay();
      return;
    }
    let cancelled=0;
    for(const row of removed){
      try{
        await firstValueFrom(this.staffApi.cancelShift(row.shiftId!));
        cancelled++;
      }catch(err){
        this.staffApi.loadWeek(this.monday(),true);
        this.toast.show(cancelled
          ? 'Đã gỡ '+cancelled+'/'+removed.length+' ca. Một số ca còn lại không thể gỡ do đang có lịch hẹn hoặc quyền hạn.'
          : 'Không thể gỡ ca làm việc. Ca có thể đang gắn với lịch hẹn đã xác nhận.', 'error');
        return;
      }
    }
    this.closeDay();
    this.staffApi.loadWeek(this.monday(),true);
    this.toast.show('Đã cập nhật ca làm việc trong ngày.', 'success');
  }
  beginNewTemplate():void {if (!this.canManageShifts()) return;this.showCreateTemplate.set(true);this.templateError.set('');}
  cancelNewTemplate():void {this.showCreateTemplate.set(false);this.templateError.set('');}
  /**
   * Save a real shift immediately for the selected employee and date.
   * There is no backend contract for reusable branch shift templates yet.
   */
  createShiftNow(): void {
    if (!this.canManageShifts()) return;
    if (this.createSaving()) return;
    const current = this.dialog();
    const branchId = this.branch();
    const name = this.templateName().trim();
    const start = this.templateStart();
    const end = this.templateEnd();
    const validTime = (time: string) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time);
    if (!current || !branchId || !current.employee.branchIds?.includes(branchId)) {
      this.templateError.set('Nhân viên chưa được phân công tại chi nhánh đã chọn.'); return;
    }
    if (!name || !validTime(start) || !validTime(end) || start === end) {
      this.templateError.set('Nhập tên ca và giờ bắt đầu, kết thúc hợp lệ và khác nhau.'); return;
    }
    const planned: DayShiftDraft = {id:'new',name,start,end};
    const assigned = this.staffApi.shifts().filter(s =>
      s.staffId === current.employee.id && s.isoDate === current.date);
    if (assigned.some(s => {
      const [from, until] = s.time.split(/[–—-]/).map(x => x.trim());
      return !!from && !!until && overlaps(planned,{id:s.shiftId ?? 'assigned',name:'',start:from,end:until});
    })) {
      this.templateError.set('Ca mới bị trùng giờ với ca đã phân tại chi nhánh này hoặc chi nhánh khác.'); return;
    }
    // All times are branch-local Vietnam times. Roll endAt to next day
    // when a shift crosses midnight, then send ISO 8601 instants to Backend.
    const startAt = new Date(current.date + 'T' + start + ':00+07:00');
    const endAt = new Date(current.date + 'T' + end + ':00+07:00');
    if (endAt <= startAt) endAt.setTime(endAt.getTime() + DAY);
    this.createSaving.set(true);
    this.templateError.set('');
    this.staffApi.createShift({
      staffId: current.employee.id,
      branchId,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
    }).subscribe({
      next: () => {
        this.createSaving.set(false);
        this.showCreateTemplate.set(false);
        this.closeDay();
        this.staffApi.loadWeek(this.monday(), true);
        this.toast.show('Đã tạo ca làm việc và phân cho nhân viên trong ngày được chọn.', 'success');
      },
      error: () => {
        this.createSaving.set(false);
        this.templateError.set('Không thể tạo ca làm việc. Vui lòng kiểm tra quyền truy cập và thử lại; chưa có thay đổi nào được lưu.');
      },
    });
  }

}
