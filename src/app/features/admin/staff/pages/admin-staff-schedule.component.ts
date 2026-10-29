import { ChangeDetectionStrategy, Component, HostListener, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminStaffWeekNavComponent } from '../components/admin-staff-week-nav.component';
import { formatStaffWeekRange } from '../utils/staff-week-range';
import { AdminStaffApiService, staffTodayISO } from '../services/admin-staff-api.service';
import { JOB_LABELS, JobRole, StaffPreview, displayStaffName } from '../models/staff-preview.model';
import { DayShiftDraft, ShiftOption, StaffShiftAssignmentDialogComponent, overlaps } from '../components/staff-shift-assignment-dialog.component';
import { StaffBulkShiftDialogComponent } from '../components/staff-bulk-shift-dialog.component';
import { AdminToastService } from '../../../../shared/services/admin-toast.service';

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

/** Phase 5: readonly FE preview. Real shifts must come from the scoped Shift API. */
@Component({
  selector: 'app-admin-staff-schedule',
  standalone: true,
  imports: [AdminCatalogShellComponent, RouterLink, AdminStaffWeekNavComponent, StaffShiftAssignmentDialogComponent, StaffBulkShiftDialogComponent],
  templateUrl: './admin-staff-schedule.component.html',
  styleUrl: './admin-staff-schedule.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminStaffScheduleComponent {
  readonly staffApi = inject(AdminStaffApiService);
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
  readonly bulkStaff = signal<StaffPreview | null>(null);
  readonly bulkDates = signal<string[]>([]);
  readonly bulkDialog = signal(false);
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
  readonly branches = computed(() => this.staffApi.branches());
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
  selectRole(value: string) { this.clearBulk(); this.role.set(value); }
  selectBranch(value: string) { if (!this.branches().some(b=>b.id===value)) return; this.clearBulk(); this.branch.set(value); this.createdOptions.set([]); }
  changeWeek(delta: number) { this.clearBulk(); this.monday.set(dateFor(this.monday(), delta * 7)); }
  goToday(): void { this.clearBulk(); this.monday.set(mondayOf(todayIso())); }

  selectDate(value: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    const parsed = new Date(value + 'T00:00:00Z');
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return;
    this.clearBulk();
    this.monday.set(mondayOf(value));
  }
  clearBulk(): void {
    this.bulkDates.set([]);
    this.bulkStaff.set(null);
    this.bulkDialog.set(false);
  }
  @HostListener('document:keydown.escape')
  onEscape(): void { if (!this.bulkDialog() && this.bulkStaff()) this.clearBulk(); }
  bulkSelected(staffId: string, date: string): boolean {
    return this.bulkStaff()?.id === staffId && this.bulkDates().includes(date);
  }
  onCellClick(employee: StaffPreview, date: string, shiftKey: boolean): void {
    if (!this.branch() || this.staffApi.shiftLoading() || !!this.staffApi.shiftError() || this.bulkDialog()) return;
    const locked = this.bulkStaff();
    if (locked && locked.id !== employee.id) return;
    if (!locked && !shiftKey) { this.openDay(employee,date); return; }
    if (!locked) this.bulkStaff.set(employee);
    this.bulkDates.update(days => days.includes(date) ? days.filter(d=>d!==date) : [...days,date].sort());
    if (!this.bulkDates().length) this.clearBulk();
  }
  openBulk(): void {
    if (this.bulkStaff() && this.bulkDates().length) this.bulkDialog.set(true);
  }
  savedBulk(): void {
    this.clearBulk();
    this.staffApi.loadWeek(this.monday(), true);
    this.toast.show('Đã lưu phân ca làm việc.', 'success');
  }
  closeBulk(): void { this.bulkDialog.set(false); }
  refreshBulk(): void { this.staffApi.loadWeek(this.monday(), true); }
  openDay(employee: StaffPreview, date: string): void {
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
  checkAssignment(data:{draft:DayShiftDraft[];scope:'day'|'weekly';from:string;to:string}):void {
    // BE only exposes create/update/cancel individual shifts, not an atomic
    // day replacement or weekly recurrence operation. Do not write a partial
    // result and claim that the entire assignment has been saved.
    this.toast.show(data.scope==='weekly'
      ? 'Đã kiểm tra lịch lặp. Chưa thể lưu vì hệ thống chưa hỗ trợ phân ca lặp hằng tuần.'
      : 'Đã kiểm tra bản phân công. Chưa thể lưu đồng loạt các thay đổi lên hệ thống.', 'info');
  }
  beginNewTemplate():void {this.showCreateTemplate.set(true);this.templateError.set('');}
  cancelNewTemplate():void {this.showCreateTemplate.set(false);this.templateError.set('');}
  /**
   * Save a real shift immediately for the selected employee and date.
   * There is no backend contract for reusable branch shift templates yet.
   */
  createShiftNow(): void {
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
        this.templateError.set('Không thể tạo ca trên hệ thống. Kiểm tra quyền và API POST /shifts của Backend; chưa có ca nào được lưu.');
      },
    });
  }

}
