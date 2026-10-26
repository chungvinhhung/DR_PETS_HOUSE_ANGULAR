import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output, signal } from '@angular/core';
import { StaffPreview, StaffShiftPreview, displayStaffName } from '../models/staff-preview.model';

export interface ShiftOption { id: string; name: string; start: string; end: string; enabled: boolean; }
export interface DayShiftDraft { id: string; name: string; start: string; end: string; shiftId?: string; }

const minutes = (clock: string): number => {
  const [h, m] = clock.split(':').map(Number);
  return h * 60 + m;
};
export function overlaps(a: DayShiftDraft, b: DayShiftDraft): boolean {
  // Valid adjacent shifts: end == next start; night shifts treated as wrapping over midnight.
  const slices = (shift: DayShiftDraft): [number, number][] => {
    const start = minutes(shift.start), end = minutes(shift.end);
    return end > start ? [[start, end]] : [[start, 1440], [0, end]];
  };
  return slices(a).some(([a0,a1]) => slices(b).some(([b0,b1]) => a0 < b1 && a1 > b0));
}
@Component({
  selector: 'app-staff-shift-assignment-dialog',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
  <div class="shift-assign-overlay" (click)="askClose()">
    <section role="dialog" aria-modal="true" aria-labelledby="assign-title" class="shift-assign-dialog" (click)="$event.stopPropagation()">
      <header class="shift-assign-header"><h2 id="assign-title">Phân công ca làm việc</h2>
        <button type="button" aria-label="Đóng" class="shift-assign-x" (click)="askClose()">×</button>
      </header>
      <div class="shift-assign-context">
        <span><small>Nhân viên</small><strong>{{ employee ? displayName(employee) : '—' }}</strong></span>
        <span><small>Ngày làm việc</small><strong>{{ dateLabel }}</strong></span>
        <span><small>Chi nhánh</small><strong>{{ branchName }}</strong></span>
      </div>
      <h3>Các ca đã phân trong ngày</h3>
      <div class="shift-assign-items">
        @for (item of draft(); track item.id) {
          <div class="shift-assign-item">
            <span class="shift-assign-clock">◷</span>
            <div><strong>{{ item.name }}</strong><small>{{ item.start }} – {{ item.end }}</small></div>
            <button type="button" [attr.aria-label]="'Gỡ ' + item.name" (click)="remove(item.id)" class="shift-assign-delete">⌫</button>
          </div>
        } @empty { <p class="shift-assign-empty">Chưa được phân ca trong ngày.</p> }
      </div>
      <h3>Thêm ca làm việc</h3>
      <div class="shift-assign-add">
        <select aria-label="Chọn ca làm việc" [value]="chosen()" (change)="chosen.set($any($event.target).value)">
          <option value="">Chọn ca làm việc</option>
          @for (o of options; track o.id) {
            @if (o.enabled) { <option [value]="o.id">{{ o.name }} ({{ o.start }}–{{ o.end }})</option> }
          }
        </select>
        <button type="button" [disabled]="!chosen()" (click)="add()">+ Thêm ca</button>
      </div>
      <button type="button" class="shift-assign-new" (click)="requestCreate.emit()">+ Tạo ca làm việc mới</button>
      @if (!options.length) { <p class="shift-assign-hint">Chưa có danh sách mẫu ca được đồng bộ từ hệ thống.</p> }
      <fieldset class="shift-assign-scope">
        <legend>Phạm vi áp dụng</legend>
        <label><input type="radio" name="repeatScope" value="day" [checked]="scope()==='day'" (change)="scope.set('day')"> Chỉ ngày này</label>
        <label><input type="radio" name="repeatScope" value="weekly" [checked]="scope()==='weekly'" (change)="scope.set('weekly')"> Lặp lại hằng tuần</label>
      </fieldset>
      @if (scope() === 'weekly') {
        <div class="shift-assign-validity"><h3>Thời gian hiệu lực</h3>
          <label>Từ ngày<input type="date" [value]="from()" (change)="from.set($any($event.target).value)"></label>
          <label>Đến ngày<input type="date" [value]="to()" (change)="to.set($any($event.target).value)"></label>
        </div>
      }
      @if (error()) { <p role="alert" class="shift-assign-error">{{ error() }}</p> }
      @if (confirmDiscard()) {
        <div class="shift-assign-discard"><p>Bỏ các thay đổi chưa lưu?</p>
          <button type="button" (click)="confirmDiscard.set(false)">Tiếp tục sửa</button>
          <button type="button" (click)="closed.emit()">Bỏ thay đổi</button>
        </div>
      }
      <footer class="shift-assign-footer">
        <button type="button" (click)="askClose()">Hủy</button>
        <button type="button" class="shift-assign-save" (click)="save()">Lưu phân công</button>
      </footer>
    </section>
  </div>`,
})
export class StaffShiftAssignmentDialogComponent {
  @Input({required:true}) employee!: StaffPreview;
  @Input({required:true}) isoDate = '';
  @Input({required:true}) branchName = '';
  @Input() options: readonly ShiftOption[] = [];
  @Input() existing: readonly DayShiftDraft[] = [];
  @Input() otherBranchShifts: readonly StaffShiftPreview[] = [];
  @Output() closed = new EventEmitter<void>();
  @Output() requestCreate = new EventEmitter<void>();
  @Output() checked = new EventEmitter<{draft: DayShiftDraft[]; scope: 'day'|'weekly'; from: string; to: string}>();
  readonly draft = signal<DayShiftDraft[]>([]);
  readonly chosen = signal('');
  readonly scope = signal<'day'|'weekly'>('day');
  readonly from = signal('');
  readonly to = signal('');
  readonly error = signal('');
  readonly dirty = signal(false);
  readonly confirmDiscard = signal(false);
  readonly displayName = displayStaffName;
  get dateLabel(): string {const [year,month,day]=this.isoDate.split('-');return [day,month,year].join('/');}
  ngOnInit():void {
    this.draft.set(this.existing.map(x=>({...x})));
    this.from.set(this.isoDate);
    this.to.set(this.isoDate);
  }
  add():void {
    const option=this.options.find(o=>o.id===this.chosen() && o.enabled);
    if(!option) {this.error.set('Vui lòng chọn ca làm việc hợp lệ.');return;}
    const next:DayShiftDraft={id:option.id,name:option.name,start:option.start,end:option.end};
    if(this.draft().some(x=>x.id===next.id || overlaps(x,next))) {
      this.error.set('Ca này đã có hoặc bị trùng giờ với ca khác.');return;
    }
    if(this.otherBranchShifts.some(x=>{
      const [start,end]=x.time.split(/[–—-]/).map(v=>v.trim());
      return start&&end&&overlaps({id:'other',name:'',start,end},next);
    })) {this.error.set('Nhân viên có ca trùng giờ ở chi nhánh khác.');return;}
    this.draft.update(xs=>[...xs,next].sort((a,b)=>a.start.localeCompare(b.start)));
    this.chosen.set('');this.dirty.set(true);this.error.set('');
  }
  remove(id:string):void {this.draft.update(xs=>xs.filter(x=>x.id!==id));this.dirty.set(true);this.error.set('');}
  askClose():void {if(this.dirty())this.confirmDiscard.set(true);else this.closed.emit();}
  save():void {
    const items=this.draft();
    if(items.some((v,i)=>items.slice(i+1).some(y=>overlaps(v,y)))) {this.error.set('Các ca làm việc đang bị trùng giờ.');return;}
    if(this.scope()==='weekly' && (!this.from()||!this.to()||this.to()<this.from())) {
      this.error.set('Vui lòng nhập khoảng thời gian hiệu lực hợp lệ.');return;
    }
    // Preview contract only. Do not signal server persistence.
    this.checked.emit({draft:items,scope:this.scope(),from:this.from(),to:this.to()});
  }
}
