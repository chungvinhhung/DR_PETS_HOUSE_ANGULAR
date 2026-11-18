import { ChangeDetectionStrategy, Component, EventEmitter, Input, OnInit, Output, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AdminStaffApiService, StaffShiftRecord } from '../services/admin-staff-api.service';
import { StaffPreview, displayStaffName } from '../models/staff-preview.model';

interface MatrixShift {
  id: string;
  name: string;
  start: string;
  end: string;
  dates: string[];
}
interface MatrixConflict {
  keys: string[];
  existing: StaffShiftRecord[];
  draftKeys: string[];
}
const DAY = 86_400_000;
const dateOffset = (date: string, offset: number): string =>
  new Date(Date.parse(date + 'T00:00:00Z') + offset * DAY).toISOString().slice(0, 10);
const validClock = (clock: string): boolean => /^([01]\d|2[0-3]):[0-5]\d$/.test(clock);
const period = (date: string, shift: Pick<MatrixShift, 'start'|'end'>) => {
  const start = new Date(date + 'T' + shift.start + ':00+07:00').getTime();
  let end = new Date(date + 'T' + shift.end + ':00+07:00').getTime();
  if (end <= start) end += DAY;
  return { start, end };
};
const intersect = (a: {start:number;end:number}, b: {start:number;end:number}) =>
  a.start < b.end && b.start < a.end;

@Component({
  selector: 'app-staff-bulk-shift-dialog',
  standalone: true,
  templateUrl: './staff-bulk-shift-dialog.component.html',
  styleUrl: './staff-bulk-shift-dialog.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class StaffBulkShiftDialogComponent implements OnInit {
  @Input({required:true}) employee!: StaffPreview;
  @Input({required:true}) branchId = '';
  @Input({required:true}) branchName = '';
  @Input({required:true}) dates: readonly string[] = [];
  @Output() closed = new EventEmitter<void>();
  @Output() saved = new EventEmitter<void>();
  @Output() updated = new EventEmitter<void>();

  private readonly staffApi = inject(AdminStaffApiService);
  readonly displayName = displayStaffName;
  readonly templates = signal<MatrixShift[]>([]);
  readonly chosen = signal<string[]>([]);
  readonly replacePlans = signal<Record<string, string[]>>({});
  readonly existing = signal<StaffShiftRecord[]>([]);
  readonly conflict = signal<MatrixConflict | null>(null);
  readonly loading = signal(true);
  readonly checkReady = signal(false);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly info = signal('');
  readonly adding = signal(false);
  readonly formName = signal('');
  readonly formStart = signal('07:00');
  readonly formEnd = signal('13:00');
  readonly formDates = signal<string[]>([]);
  readonly confirmClose = signal(false);
  private serial = 0;
  private nextId = 0;

  ngOnInit(): void {
    this.formDates.set([...this.dates]);
    void this.reloadExisting();
  }
  private async reloadExisting(): Promise<void> {
    const serial = ++this.serial;
    this.loading.set(true);
    this.checkReady.set(false);
    this.error.set('');
    try {
      // Search the adjacent days as well so overnight assignments are detected.
      const rows = await firstValueFrom(this.staffApi.listStaffShiftRecords(
        this.employee.id, dateOffset(this.dates[0], -1), dateOffset(this.dates[this.dates.length-1], 2),
      ));
      if (serial !== this.serial) return;
      this.existing.set(rows);
      this.checkReady.set(true);
    } catch {
      if (serial !== this.serial) return;
      this.error.set('Không tải được lịch đã phân của nhân viên. Không thể kiểm tra trùng giờ an toàn.');
    } finally {
      if (serial === this.serial) this.loading.set(false);
    }
  }
  cellKey(shift: MatrixShift, date: string): string { return shift.id + '|' + date; }
  available(shift: MatrixShift, date: string): boolean { return shift.dates.includes(date); }
  checked(shift: MatrixShift, date: string): boolean { return this.chosen().includes(this.cellKey(shift,date)); }
  selectedCount(): number { return this.chosen().length; }
  affectedDays(): number { return new Set(this.chosen().map(key => key.split('|')[1])).size; }
  replacedIds(): string[] {
    const plans = this.replacePlans(), selected = this.chosen();
    return [...new Set(selected.flatMap(key => plans[key] ?? []))];
  }
  assignedToThisBranch(shift: MatrixShift, date: string): boolean {
    const time = period(date,shift);
    return this.existing().some(s => s.branchId === this.branchId &&
      s.startAt && s.endAt && intersect(time, {start:Date.parse(s.startAt),end:Date.parse(s.endAt)}));
  }
  rowAllChecked(shift: MatrixShift): boolean {
    return shift.dates.length > 0 && shift.dates.every(d => this.checked(shift,d));
  }
  toggleDayForm(date: string): void {
    this.formDates.update(current => current.includes(date) ? current.filter(d=>d!==date) : [...current,date]);
  }
  addTemplate(): void {
    const name = this.formName().trim(), start = this.formStart(), end = this.formEnd();
    if (!name || !validClock(start) || !validClock(end) || start === end || !this.formDates().length) {
      this.error.set('Nhập tên ca, giờ bắt đầu/kết thúc khác nhau và ít nhất một ngày áp dụng.');
      return;
    }
    this.templates.update(rows => [...rows, {id:'local-'+(++this.nextId),name,start,end,dates:[...this.formDates()]}]);
    this.adding.set(false);this.error.set('');this.info.set('');
    this.formName.set('');this.formDates.set([...this.dates]);
  }
  removeTemplate(id: string): void {
    this.templates.update(rows => rows.filter(s=>s.id!==id));
    this.chosen.update(keys=>keys.filter(k=>!k.startsWith(id+'|')));
    this.replacePlans.update(plans=>Object.fromEntries(Object.entries(plans).filter(([key])=>!key.startsWith(id+'|'))));
  }
  toggleCell(shift: MatrixShift, date: string): void {
    if (this.loading() || !this.checkReady() || this.saving() || !this.available(shift,date) || this.conflict()) return;
    const key = this.cellKey(shift,date);
    if (this.chosen().includes(key)) { this.uncheck([key]);return; }
    this.trySelect([key]);
  }
  toggleRow(shift: MatrixShift): void {
    if (this.loading() || !this.checkReady() || this.saving() || this.conflict()) return;
    const keys=shift.dates.map(date=>this.cellKey(shift,date));
    if (keys.every(key=>this.chosen().includes(key))) this.uncheck(keys);
    else this.trySelect(keys.filter(key=>!this.chosen().includes(key)));
  }
  private uncheck(keys: readonly string[]): void {
    this.chosen.update(current=>current.filter(key=>!keys.includes(key)));
    this.replacePlans.update(plans=>Object.fromEntries(Object.entries(plans).filter(([key])=>!keys.includes(key))));
    this.error.set('');this.info.set('');
  }
  clearAll(): void {
    this.chosen.set([]);this.replacePlans.set({});this.conflict.set(null);
    this.error.set('');this.info.set('');
  }
  private toPeriod(key: string): {start:number;end:number} {
    const [id,date]=key.split('|'), template=this.templates().find(x=>x.id===id)!;
    return period(date,template);
  }
  private trySelect(keys: string[]): void {
    if (!keys.length) return;
    const fresh = keys.filter(k=>!this.chosen().includes(k));
    const existing = this.existing().filter(s=>!this.replacedIds().includes(s.id) &&
      fresh.some(k=>intersect(this.toPeriod(k),{start:Date.parse(s.startAt),end:Date.parse(s.endAt)})));
    const local = this.chosen().filter(k=>fresh.some(next=>intersect(this.toPeriod(k),this.toPeriod(next))));
    // Never silently accept two new, mutually overlapping shifts.
    if (fresh.some((key,i)=>fresh.slice(i+1).some(next=>intersect(this.toPeriod(key),this.toPeriod(next))))) {
      this.error.set('Các ca vừa chọn có thời gian trùng nhau. Hãy chọn từng ca phù hợp.');
      return;
    }
    if (existing.length || local.length) {
      this.conflict.set({keys:fresh,existing,draftKeys:local});
      this.error.set('');
      return;
    }
    this.chosen.update(p=>[...p,...fresh]);
    this.info.set('');this.error.set('');
  }
  cancelConflict(): void { this.conflict.set(null); }
  acceptReplacement(): void {
    const pending=this.conflict();if(!pending)return;
    const keys = pending.keys, removed = pending.draftKeys;
    this.chosen.update(current=>[...current.filter(k=>!removed.includes(k)),...keys]);
    this.replacePlans.update(plan=>{
      const next = Object.fromEntries(Object.entries(plan).filter(([key])=>!removed.includes(key)));
      for (const key of keys) {
        const overlap = pending.existing.filter(s=>intersect(this.toPeriod(key),{
          start:Date.parse(s.startAt),end:Date.parse(s.endAt),
        }));
        next[key] = overlap.map(s=>s.id);
      }
      return next;
    });
    this.conflict.set(null);this.error.set('');
    this.info.set('Đã ghi nhận các ca chờ thay thế. Lịch cũ chưa bị thay đổi; chỉ xử lý khi lưu.');
  }
  overlappingDescription(s: StaffShiftRecord): string {
    const time = new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',hour12:false});
    const date = new Intl.DateTimeFormat('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',day:'2-digit',month:'2-digit'});
    return s.branch + ' · ' + date.format(new Date(s.startAt)) + ' · ' +
      time.format(new Date(s.startAt)) + '–' + time.format(new Date(s.endAt));
  }
  dayLabel(date: string): string {
    const day=new Date(date+'T00:00:00Z').getUTCDay();
    return (day===0?'CN':'T'+(day+1)) + ' · ' + date.slice(8,10)+'/'+date.slice(5,7);
  }
  shiftLabel(key: string): string {
    const [id,date] = key.split('|'), shift=this.templates().find(s=>s.id===id);
    return (shift?.name ?? 'Ca làm') + ' · ' + this.dayLabel(date) +
      ' · ' + (shift?.start ?? '') + '–' + (shift?.end ?? '');
  }
  askClose(): void {
    if (this.saving()) return;
    if (this.chosen().length) this.confirmClose.set(true);
    else this.closed.emit();
  }
  async save(): Promise<void> {
    if (this.loading() || !this.checkReady() || this.saving() || this.conflict() || !this.chosen().length) return;
    this.saving.set(true);this.error.set('');this.info.set('');
    const payload = this.chosen().map(key=>{
      const item=this.toPeriod(key);
      return {startAt:new Date(item.start).toISOString(),endAt:new Date(item.end).toISOString()};
    });
    try {
      // Cross-branch replacement MUST be atomic. Current BE only supports
      // POST /shifts + individual cancel; never do cancel-then-create here.
      const cancelled = this.replacedIds();
      if (cancelled.length) {
        await firstValueFrom(this.staffApi.replaceShiftsAtomically({
          staffId:this.employee.id,branchId:this.branchId,create:payload,cancelShiftIds:cancelled,
        }));
      } else {
        // Existing BE supports only single-shift creates. Report partial results
        // precisely if one of the later requests fails, instead of faking success.
        let created=0;
        for (const candidate of payload) {
          try {
            await firstValueFrom(this.staffApi.createShift({
              staffId:this.employee.id,branchId:this.branchId,...candidate,
            }));
            created++;
          } catch (err) {
            if (created) {
              const completed = this.chosen().slice(0,created);
              this.uncheck(completed);this.updated.emit();
              await this.reloadExisting();
              this.error.set('Đã lưu '+created+'/'+payload.length+' ca. Các ca còn lại chưa được lưu; hãy kiểm tra lịch trước khi thử lại.');
              return;
            }
            throw err;
          }
        }
      }
      this.saved.emit();
    } catch (err: unknown) {
      const status = (err as {status?:number})?.status;
      if (this.replacedIds().length && (status===404 || status===405 || status===501)) {
        this.error.set('Chưa thể thay thế ca hàng loạt lúc này. Lịch làm việc hiện tại vẫn được giữ nguyên.');
      } else if (status===403) {
        this.error.set('Tài khoản không có quyền phân ca hoặc sửa lịch tại một trong các chi nhánh liên quan.');
      } else if (status===409) {
        await this.reloadExisting();
        this.error.set('Lịch đã thay đổi hoặc bị trùng giờ trên hệ thống. Vui lòng xử lý lại xung đột trước khi lưu.');
      } else {
        this.error.set('Chưa thể lưu phân công. Hệ thống giữ nguyên các lựa chọn để bạn thử lại.');
      }
    } finally {
      this.saving.set(false);
    }
  }
}
