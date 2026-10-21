import { ChangeDetectionStrategy, Component, HostListener, Input, signal } from '@angular/core';
import { inject } from '@angular/core';
import { AdminToastService } from '../../../../shared/services/admin-toast.service';

interface ShiftTemplatePreview {
  id: string;
  name: string;
  start: string;
  end: string;
  days: number[];
  enabled: boolean;
}
const SAMPLE_SHIFTS: ShiftTemplatePreview[] = [
  { id: 'demo-am', name: 'Ca sáng', start: '07:00', end: '15:00', days: [1, 2, 3, 4, 5, 6, 7], enabled: true },
  { id: 'demo-pm', name: 'Ca chiều', start: '15:00', end: '22:00', days: [1, 2, 3, 4, 5, 6, 7], enabled: true },
  { id: 'demo-office', name: 'Ca hành chính', start: '08:00', end: '17:00', days: [1, 2, 3, 4, 5], enabled: true },
];

/** Figma V2 shift template UI. Local editing is deliberate: BE persistence is not implemented. */
@Component({
  selector: 'app-branch-shift-templates-preview',
  standalone: true,
  template: `
    <section class="branch-management__panel branch-v2" aria-labelledby="branch-shift-heading">
      <div class="branch-v2__heading">
        <div>
          <h2 id="branch-shift-heading">Ca làm việc tại chi nhánh</h2>
          
        </div>
        <button class="branch-management__button branch-management__button--primary" type="button"
          (click)="openEditor()">+ Thêm ca làm việc</button>
      </div>
      <div class="branch-management__table-scroll">
        <table class="branch-management__table branch-v2__shifts">
          <colgroup>
            <col style="width: 18%" />
            <col style="width: 16%" />
            <col style="width: 18%" />
            <col style="width: 24%" />
            <col style="width: 15%" />
            <col style="width: 9%" />
          </colgroup>
          <thead><tr><th scope="col">Tên ca</th><th scope="col">Bắt đầu</th><th scope="col">Kết thúc</th>
            <th scope="col">Ngày áp dụng</th><th scope="col">Trạng thái</th><th scope="col">Thao tác</th></tr></thead>
          <tbody>
            @for (item of items(); track item.id) {
              <tr>
                <td><strong>{{ item.name }}</strong></td>
                <td>{{ item.start }}</td>
                <td>{{ item.end }}{{ item.end < item.start ? ' hôm sau' : '' }}</td>
                <td>{{ daysLabel(item.days) }}</td>
                <td><span class="branch-management__pill" [class.branch-management__pill--off]="!item.enabled">
                  {{ item.enabled ? 'Đang dùng' : 'Ngừng dùng' }}
                </span></td>
                <td class="branch-v2__edit-cell"><button class="branch-v2__edit-icon" type="button" title="Chỉnh sửa"
                  [attr.aria-label]="'Sửa ' + item.name" (click)="openEditor(item)"><img src="/assets/admin-staff/icon-edit.svg" width="20" height="20" alt="" /></button></td>
              </tr>
            } @empty {
              <tr><td colspan="6" class="branch-management__empty">Chưa có mẫu ca nào.</td></tr>
            }
          </tbody>
        </table>
      </div>

    </section>

    @if (editorOpen()) {
      <div class="branch-v2__overlay" (click)="requestClose()" role="presentation">
        <section class="branch-v2__modal" role="dialog" aria-modal="true" aria-labelledby="branch-shift-modal"
          (click)="$event.stopPropagation()">
          <header class="branch-v2__modal-header">
            <div>
              <h2 id="branch-shift-modal">{{ editingId() ? 'Sửa ca làm việc' : 'Thêm ca làm việc' }}</h2>
              <p>{{ branchName }} • Chỉ lưu tạm trên giao diện</p>
            </div>
            <button type="button" aria-label="Đóng" (click)="requestClose()">×</button>
          </header>
          <form (submit)="savePreview($event)" class="branch-v2__form" novalidate>
            <label class="branch-v2__field">
              <span>Tên ca làm việc <b>*</b></span>
              <input #nameInput type="text" maxlength="80" placeholder="Ví dụ: Ca sáng"
                [value]="formName()" (input)="changeName(nameInput.value)" />
            </label>
            <div class="branch-v2__time-fields">
              <label class="branch-v2__field">
                <span>Bắt đầu <b>*</b></span>
                <input #startInput type="time" [value]="formStart()" (input)="changeStart(startInput.value)" />
              </label>
              <label class="branch-v2__field">
                <span>Kết thúc <b>*</b></span>
                <input #endInput type="time" [value]="formEnd()" (input)="changeEnd(endInput.value)" />
              </label>
            </div>
            <fieldset class="branch-v2__weekday-fieldset">
              <legend>Ngày áp dụng · Có thể chọn nhiều <b>*</b></legend>
              <div class="branch-v2__weekday-picker">
                @for (day of weekdays; track day.id) {
                  <label>
                    <input #dayCheck type="checkbox" [checked]="formDays().includes(day.id)"
                      (change)="toggleDay(day.id, dayCheck.checked)" />
                    <span>{{ day.label }}</span>
                  </label>
                }
              </div>
            </fieldset>
            <label class="branch-v2__toggle-line">
              <span>Trạng thái ca làm việc <small>{{ formEnabled() ? 'Đang sử dụng' : 'Ngừng sử dụng' }}</small></span>
              <input #enabledInput type="checkbox" role="switch" [checked]="formEnabled()"
                (change)="changeEnabled(enabledInput.checked)" />
            </label>
            @if (formError()) { <p class="branch-v2__form-error" role="alert">{{ formError() }}</p> }
            @if (confirmDiscard()) {
              <div class="branch-v2__discard" role="alert">
                <p>Bỏ các thay đổi chưa lưu?</p>
                <button type="button" (click)="closeEditor()">Bỏ thay đổi</button>
                <button type="button" (click)="confirmDiscard.set(false)">Tiếp tục sửa</button>
              </div>
            }
            <footer class="branch-v2__modal-footer">
              <button class="branch-management__button branch-management__button--outline" type="button" (click)="requestClose()">Hủy</button>
              <button class="branch-management__button branch-management__button--primary" type="submit">Lưu ca làm việc (demo)</button>
            </footer>
          </form>
        </section>
      </div>
    }
  `,
  styles: [`
    /* Component-local: page SCSS cannot reliably style cells in a standalone
       child component under Angular Emulated ViewEncapsulation. */
    :host { display: block; min-width: 0; }
    .branch-management__table-scroll {
      width: 100%;
      overflow-x: auto;
      border: 1px solid #dce4ee;
      border-radius: 10px;
      background: #fff;
    }
    .branch-v2__shifts {
      width: 100%;
      min-width: 780px;
      border-collapse: collapse;
      table-layout: fixed;
      font: 400 13px/20px Roboto, Arial, sans-serif;
      color: #334155;
    }
    .branch-v2__shifts thead { background: #f1f5f9; }
    .branch-v2__shifts :is(th, td) {
      padding: 12px 16px;
      text-align: left;
      vertical-align: middle;
      box-sizing: border-box;
    }
    .branch-v2__shifts th {
      height: 54px;
      color: #475569;
      font: 500 13px/20px Roboto, Arial, sans-serif;
      white-space: nowrap;
      text-transform: none;
    }
    .branch-v2__shifts td {
      height: 72px;
      border-top: 1px solid #e2e8f0;
      font-size: 14px;
    }
    .branch-v2__shifts tbody td strong { font-weight: 500; }
    .branch-v2__shifts :is(th, td):last-child {
      text-align: center;
      padding-right: 12px;
      padding-left: 12px;
    }
    .branch-v2__shifts tbody tr:hover td { background: #f8fbff; }
    .branch-management__pill {
      display: inline-flex;
      align-items: center;
      border: 1px solid #c8e6c9;
      border-radius: 999px;
      background: #e8f5e9;
      color: #2e7d32;
      padding: 4px 10px;
      font-size: 12px;
      white-space: nowrap;
    }
    .branch-management__pill--off {
      border-color: #dce4ee;
      background: #eff2f5;
      color: #64748b;
    }
    .branch-v2__edit-icon {
      display: inline-flex;
      justify-content: center;
      align-items: center;
      width: 32px;
      height: 32px;
      padding: 0;
      border: 0;
      border-radius: 6px;
      background: transparent;
      cursor: pointer;
    }
    .branch-v2__edit-icon:hover { background: #e5f6fd; }
    .branch-v2__edit-icon img { display: block; width: 20px; height: 20px; }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchShiftTemplatesPreviewComponent {
  private readonly toast = inject(AdminToastService);
  @Input() branchName = 'Chi nhánh';

  readonly weekdays = [
    { id: 1, label: 'Thứ 2' }, { id: 2, label: 'Thứ 3' }, { id: 3, label: 'Thứ 4' },
    { id: 4, label: 'Thứ 5' }, { id: 5, label: 'Thứ 6' }, { id: 6, label: 'Thứ 7' }, { id: 7, label: 'CN' },
  ];
  readonly items = signal<readonly ShiftTemplatePreview[]>(SAMPLE_SHIFTS.map((item) => ({ ...item, days: [...item.days] })));
  readonly editorOpen = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly formName = signal('');
  readonly formStart = signal('08:00');
  readonly formEnd = signal('17:00');
  readonly formDays = signal<readonly number[]>([1, 2, 3, 4, 5]);
  readonly formEnabled = signal(true);
  readonly formError = signal('');
  readonly feedback = signal('');
  readonly dirty = signal(false);
  readonly confirmDiscard = signal(false);
  private nextId = 1;

  get activeCount(): number { return this.items().filter((shift) => shift.enabled).length; }

  daysLabel(days: readonly number[]): string {
    const sorted = [...days].sort((a, b) => a - b);
    if (sorted.length === 7) return 'Thứ 2 – Chủ nhật';
    if (sorted.length === 5 && sorted.every((day, index) => day === index + 1)) return 'Thứ 2 – Thứ 6';
    return sorted.map((id) => this.weekdays.find((day) => day.id === id)?.label ?? '').join(', ');
  }

  openEditor(item?: ShiftTemplatePreview): void {
    this.editingId.set(item?.id ?? null);
    this.formName.set(item?.name ?? '');
    this.formStart.set(item?.start ?? '08:00');
    this.formEnd.set(item?.end ?? '17:00');
    this.formDays.set([...(item?.days ?? [1, 2, 3, 4, 5])]);
    this.formEnabled.set(item?.enabled ?? true);
    this.formError.set('');
    this.confirmDiscard.set(false);
    this.dirty.set(false);
    this.editorOpen.set(true);
  }

  changeName(v: string): void { this.formName.set(v); this.markDirty(); }
  changeStart(v: string): void { this.formStart.set(v); this.markDirty(); }
  changeEnd(v: string): void { this.formEnd.set(v); this.markDirty(); }
  changeEnabled(v: boolean): void { this.formEnabled.set(v); this.markDirty(); }

  toggleDay(id: number, checked: boolean): void {
    this.formDays.update((days) => checked ? [...days, id].sort((a, b) => a - b) : days.filter((day) => day !== id));
    this.markDirty();
  }

  private markDirty(): void {
    this.dirty.set(true);
    this.confirmDiscard.set(false);
    this.formError.set('');
  }

  savePreview(event: Event): void {
    event.preventDefault();
    const name = this.formName().trim();
    const start = this.formStart();
    const end = this.formEnd();
    if (!name) { this.formError.set('Vui lòng nhập tên mẫu ca.'); return; }
    if (!/^\d{2}:\d{2}$/.test(start) || !/^\d{2}:\d{2}$/.test(end) || start === end) {
      this.formError.set('Giờ bắt đầu và kết thúc phải hợp lệ và khác nhau. Ca qua đêm được phép.'); return;
    }
    if (this.formDays().length === 0) { this.formError.set('Vui lòng chọn ít nhất một ngày áp dụng.'); return; }
    if (this.items().some((item) => item.id !== this.editingId() && item.name.toLocaleLowerCase('vi') === name.toLocaleLowerCase('vi'))) {
      this.formError.set('Tên mẫu ca đang trùng với một mẫu khác.'); return;
    }
    const id = this.editingId() ?? `local-${this.nextId++}`;
    const entry: ShiftTemplatePreview = {
      id, name, start, end, days: [...this.formDays()], enabled: this.formEnabled(),
    };
    this.items.update((items) => this.editingId()
      ? items.map((item) => item.id === id ? entry : item)
      : [...items, entry]);
    this.toast.show('Đã sửa ca trên giao diện demo. Chưa lưu vào Backend.', 'info');
    this.closeEditor();
  }

  requestClose(): void {
    if (this.dirty()) this.confirmDiscard.set(true);
    else this.closeEditor();
  }

  closeEditor(): void {
    this.editorOpen.set(false);
    this.confirmDiscard.set(false);
    this.dirty.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (!this.editorOpen()) return;
    if (this.confirmDiscard()) { this.confirmDiscard.set(false); return; }
    this.requestClose();
  }
}
