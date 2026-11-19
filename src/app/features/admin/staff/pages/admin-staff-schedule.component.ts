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
import { AdminToastService, adminErrorMessage } from '../../../../shared/services/admin-toast.service';
import { BranchManagementApiService } from '../../branch-management/services/branch-management-api.service';
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
  private readonly branchApi = inject(BranchManagementApiService);
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
  readonly templatesLoading = signal(false);
  readonly templatesError = signal('');
  readonly pendingTemplateId = signal('');
  private templateRequestId = 0;
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
    const user = this.session.user();
    const ownProfile = this.staffApi.staff().find(staff => staff.userId === user?.id);
    // STAFF receives only their own scoped profile from BE. Fail closed until
    // this profile resolves, not on the optional /auth/me branchScope alone.
    const scope = new Set((ownProfile?.branchIds ?? []).map(String));
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
  selectBranch(value: string) {
    if (!this.branches().some(b=>b.id===value)) return;
    this.branch.set(value);
    this.createdOptions.set([]);
    this.pendingTemplateId.set('');
    this.loadTemplates(value);
  }
  private loadTemplates(branchId: string, selectId = ''): void {
    if (!branchId) return;
    const requestId = ++this.templateRequestId;
    this.templatesLoading.set(true);
    this.templatesError.set('');
    this.branchApi.listShiftTemplates(branchId).subscribe({
      next: templates => {
        if (requestId !== this.templateRequestId || branchId !== this.branch()) return;
        this.createdOptions.set(templates.map(t => ({
          id: t.id, name: t.name, start: t.startTime, end: t.endTime,
          enabled: t.status === 'ACTIVE',
        })));
        this.templatesLoading.set(false);
        if (selectId && templates.some(t => t.id === selectId && t.status === 'ACTIVE')) {
          this.pendingTemplateId.set(selectId);
        }
      },
      error: err => {
        if (requestId !== this.templateRequestId || branchId !== this.branch()) return;
        this.templatesLoading.set(false);
        this.templatesError.set(adminErrorMessage(err, 'Không tải được các ca của chi nhánh. Vui lòng thử lại.'));
      },
    });
  }
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
    this.pendingTemplateId.set('');
    this.dialog.set({employee,date});
    this.loadTemplates(this.branch());
  }
  closeDay():void {
    this.dialog.set(null);this.showCreateTemplate.set(false);this.pendingTemplateId.set('');
  }
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
    if (!this.canManageShifts() || this.createSaving()) return;
    if (data.scope !== 'day') {
      this.toast.show('Phân ca lặp hằng tuần chưa được hệ thống hỗ trợ.', 'info');
      return;
    }
    const context=this.dialog();
    const branchId=this.branch();
    if (!context || !branchId || !context.employee.branchIds?.includes(branchId)) return;
    const current=this.forDay();
    const desiredIds=new Set(data.draft.map(x=>x.shiftId).filter((id):id is string=>!!id));
    const removed=current.filter(row=>row.shiftId&&!desiredIds.has(row.shiftId));
    const added=data.draft.filter(row=>!row.shiftId);
    if (added.some(x=>!this.createdOptions().some(t=>t.id===x.id&&t.enabled))) {
      this.toast.show('Mẫu ca đã thay đổi. Vui lòng tải lại danh sách ca và thử lại.', 'error');
      this.loadTemplates(branchId);
      return;
    }
    // The selected template is only a draft until Lưu phân công is clicked.
    // POST /shifts creates a real dated assignment; template CRUD is separate.
    const toInstant=(date:string,time:string)=>new Date(date+'T'+time+':00+07:00');
    this.createSaving.set(true);
    let completed=0;
    try {
      for (const row of removed) {
        await firstValueFrom(this.staffApi.cancelShift(row.shiftId!));
        completed++;
      }
      for (const row of added) {
        const startAt=toInstant(context.date,row.start);
        const endAt=toInstant(context.date,row.end);
        if (endAt<=startAt) endAt.setTime(endAt.getTime()+DAY);
        await firstValueFrom(this.staffApi.createShift({
          staffId:context.employee.id, branchId,
          startAt:startAt.toISOString(),endAt:endAt.toISOString(),
        }));
        completed++;
      }
      this.closeDay();
      this.staffApi.loadWeek(this.monday(),true);
      this.toast.show('Đã lưu phân công ca làm việc.', 'success');
    } catch (error) {
      this.staffApi.loadWeek(this.monday(),true);
      this.toast.show(
        completed ? 'Một số ca đã được cập nhật nhưng có thao tác thất bại. Vui lòng kiểm tra lịch rồi thử lại.'
          : adminErrorMessage(error,'Không thể lưu phân công. Vui lòng thử lại.'), 'error');
      // Close only on partial mutations, to avoid resubmitting the same operations.
      if (completed) this.closeDay();
    } finally {
      this.createSaving.set(false);
    }
  }
  beginNewTemplate():void {if (!this.canManageShifts()) return;this.showCreateTemplate.set(true);this.templateError.set('');}
  cancelNewTemplate():void {this.showCreateTemplate.set(false);this.templateError.set('');}
  /** Create a reusable branch template. Never save an employee assignment here. */
  createShiftNow(): void {
    if (!this.canManageShifts() || this.createSaving()) return;
    const context = this.dialog();
    const branchId = this.branch();
    const name = this.templateName().trim();
    const start = this.templateStart();
    const end = this.templateEnd();
    const validTime = (time: string) => /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time);
    if (!context || !branchId) return;
    if (name.length < 2 || name.length > 100 || !validTime(start) || !validTime(end) || start === end) {
      this.templateError.set('Nhập tên ca (2–100 ký tự) và giờ bắt đầu, kết thúc hợp lệ.'); return;
    }
    this.createSaving.set(true);
    this.templateError.set('');
    this.branchApi.createShiftTemplate(branchId, {
      name, startTime: start, endTime: end, daysOfWeek: [0,1,2,3,4,5,6],
      status: 'ACTIVE',
    }).subscribe({
      next: created => {
        this.createSaving.set(false);
        this.showCreateTemplate.set(false);
        // Keep the assignment modal and its day/employee context mounted.
        this.createdOptions.update(list=>[
          ...list.filter(t=>t.id!==created.id),
          {id:created.id,name:created.name,start:created.startTime,end:created.endTime,enabled:true},
        ]);
        this.pendingTemplateId.set(created.id);
        this.loadTemplates(branchId);
        this.toast.show('Đã tạo mẫu ca. Kiểm tra ca được chọn rồi bấm Lưu phân công.', 'success');
      },
      error: error => {
        this.createSaving.set(false);
        this.templateError.set(adminErrorMessage(error, 'Không tạo được mẫu ca làm việc. Vui lòng thử lại.'));
      },
    });
  }

}
