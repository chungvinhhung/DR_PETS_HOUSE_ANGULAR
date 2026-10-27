import { ChangeDetectionStrategy, Component, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminStaffWeekNavComponent } from '../components/admin-staff-week-nav.component';
import { formatStaffWeekRange } from '../utils/staff-week-range';
import { AdminStaffApiService, staffTodayISO } from '../services/admin-staff-api.service';
import { JOB_LABELS, JobRole, StaffPreview, displayStaffName } from '../models/staff-preview.model';
import { DayShiftDraft, ShiftOption, StaffShiftAssignmentDialogComponent } from '../components/staff-shift-assignment-dialog.component';
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
  imports: [AdminCatalogShellComponent, RouterLink, AdminStaffWeekNavComponent, StaffShiftAssignmentDialogComponent],
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
  readonly createdOptions = signal<ShiftOption[]>([]);
  readonly showCreateTemplate = signal(false);
  readonly templateName = signal('');
  readonly templateStart = signal('08:00');
  readonly templateEnd = signal('17:00');
  readonly templateError = signal('');
  readonly selectedOptions = computed(() => this.createdOptions());
  readonly role = signal('ALL');
  readonly page = signal(1);
  readonly pageSize = 6;
  readonly roles = Object.entries(JOB_LABELS) as [JobRole, string][];
  readonly branches = computed(() => this.staffApi.branches());
  readonly activeBranch = computed(() => this.branches().find(x => x.id === this.branch()));
  readonly days = computed(() => Array.from({ length: 7 }, (_, index) => {
    const iso = dateFor(this.monday(), index);
    return {
      iso,
      weekday: index === 6 ? 'CN' : 'Thứ ' + (index + 2),
      dayMonth: readable(iso),
    };
  }));
  readonly weekLabel = computed(() => formatStaffWeekRange(this.monday()));
  readonly filtered = computed(() => this.staffApi.staff().filter(staff =>
    (this.role() === 'ALL' || staff.jobRole === this.role()) &&
    !!this.branch() && !!staff.branchIds?.includes(this.branch())));
  readonly pageCount = computed(() => Math.max(1, Math.ceil(this.filtered().length / this.pageSize)));
  readonly visiblePageNumbers = computed(() => {
    const total = this.pageCount();
    const current = this.page();
    const start = Math.max(1, Math.min(current - 1, total - 2));
    return Array.from({length: Math.min(3,total)}, (_, i) => start + i);
  });
  readonly rows = computed(() => this.filtered().slice((this.page() - 1) * this.pageSize, this.page() * this.pageSize));

  displayName = displayStaffName;
  roleLabel(staff: StaffPreview): string { return JOB_LABELS[staff.jobRole]; }
  shifts(staffId: string, iso: string) {
    return this.staffApi.shifts().filter(shift =>
      shift.staffId === staffId && shift.isoDate === iso &&
      shift.branchId === this.branch()).sort((a,b)=>a.time.localeCompare(b.time));
  }
  selectRole(value: string) { this.role.set(value); this.page.set(1); }
  selectBranch(value: string) { if (!this.branches().some(b=>b.id===value)) return; this.branch.set(value); this.page.set(1); this.createdOptions.set([]); }
  changePage(value: number) { if (value >= 1 && value <= this.pageCount()) this.page.set(value); }
  changeWeek(delta: number) { this.monday.set(dateFor(this.monday(), delta * 7)); }
  goToday(): void { this.monday.set(mondayOf(todayIso())); }

  selectDate(value: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    const parsed = new Date(value + 'T00:00:00Z');
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) return;
    this.monday.set(mondayOf(value));
  }
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
  addLocalTemplate():void {
    const name=this.templateName().trim(),start=this.templateStart(),end=this.templateEnd();
    if(!name || !/^\\d{2}:\\d{2}$/.test(start) || !/^\\d{2}:\\d{2}$/.test(end) || start===end) {
      this.templateError.set('Vui lòng nhập tên và giờ làm việc hợp lệ.');return;
    }
    if(this.createdOptions().some(x=>x.name.toLocaleLowerCase('vi')===name.toLocaleLowerCase('vi'))) {
      this.templateError.set('Tên ca đã tồn tại trong bản nháp.');return;
    }
    this.createdOptions.update(list=>[...list,{id:'local-'+list.length,name,start,end,enabled:true}]);
    this.showCreateTemplate.set(false);
    this.toast.show('Đã thêm ca vào bản nháp. Chưa lưu định nghĩa ca vào hệ thống.', 'info');
  }

}
