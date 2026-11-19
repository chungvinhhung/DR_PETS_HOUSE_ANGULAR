import { ChangeDetectionStrategy, Component, DestroyRef, Input, OnChanges, SimpleChanges, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AdminDataStateComponent } from '../../../../shared/admin-data-state/admin-data-state.component';
import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { adminErrorMessage } from '../../../../shared/services/admin-toast.service';
import {
  BranchManagementApiService, BranchShiftTemplate, BranchShiftTemplateWrite,
} from '../services/branch-management-api.service';

const DEFAULT_SHIFT: BranchShiftTemplateWrite = {
  name: '', startTime: '08:00', endTime: '17:00',
  daysOfWeek: [1, 2, 3, 4, 5], status: 'ACTIVE',
};

@Component({
  selector: 'app-branch-shift-templates-preview',
  standalone: true,
  imports: [RouterLink, AdminDataStateComponent],
  templateUrl: './branch-shift-templates-preview.component.html',
  styleUrl: './branch-shift-templates-preview.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchShiftTemplatesPreviewComponent implements OnChanges {
  @Input() branchId = '';
  @Input() branchName = '';

  private readonly api = inject(BranchManagementApiService);
  private readonly session = inject(AuthSessionService);
  private readonly destroyRef = inject(DestroyRef);
  private requestVersion = 0;

  readonly days = [
    { id: 1, label: 'T2', longLabel: 'Thứ 2' },
    { id: 2, label: 'T3', longLabel: 'Thứ 3' },
    { id: 3, label: 'T4', longLabel: 'Thứ 4' },
    { id: 4, label: 'T5', longLabel: 'Thứ 5' },
    { id: 5, label: 'T6', longLabel: 'Thứ 6' },
    { id: 6, label: 'T7', longLabel: 'Thứ 7' },
    { id: 0, label: 'CN', longLabel: 'Chủ nhật' },
  ] as const;
  readonly rows = signal<BranchShiftTemplate[]>([]);
  readonly loading = signal(false);
  readonly error = signal('');
  readonly notice = signal('');
  readonly busy = signal(false);
  readonly showEditor = signal(false);
  readonly deleting = signal<BranchShiftTemplate | null>(null);
  readonly editingId = signal<string | null>(null);
  readonly draft = signal<BranchShiftTemplateWrite>({ ...DEFAULT_SHIFT, daysOfWeek: [...DEFAULT_SHIFT.daysOfWeek] });
  readonly formError = signal('');
  readonly mayEdit = computed(() => ['ADMIN', 'MANAGER'].includes(this.session.user()?.systemRole || ''));

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['branchId']) {
      this.showEditor.set(false);
      this.deleting.set(null);
      this.notice.set('');
      this.load();
    }
  }

  load(): void {
    const request = ++this.requestVersion;
    if (!this.branchId) {
      this.rows.set([]);
      this.loading.set(false);
      return;
    }
    this.loading.set(true);
    this.error.set('');
    this.api.listShiftTemplates(this.branchId)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => {
        if (request === this.requestVersion) this.loading.set(false);
      }))
      .subscribe({
        next: data => {
          if (request !== this.requestVersion) return;
          if (!Array.isArray(data)) {
            this.error.set('Không thể đọc danh sách ca làm việc. Vui lòng thử lại.');
            this.rows.set([]);
            return;
          }
          this.rows.set(data);
        },
        error: err => {
          if (request !== this.requestVersion) return;
          this.rows.set([]);
          this.error.set(adminErrorMessage(err, 'Không thể tải ca làm việc. Vui lòng thử lại.'));
        },
      });
  }

  dayLabel(days: readonly number[]): string {
    if (days.length === 7) return 'Hằng ngày';
    if (days.length === 5 && [1,2,3,4,5].every(day => days.includes(day))) return 'Thứ 2 – Thứ 6';
    return this.days.filter(day => days.includes(day.id)).map(day => day.longLabel).join(', ') || 'Chưa chọn';
  }

  openCreate(): void {
    if (!this.mayEdit() || this.busy()) return;
    this.editingId.set(null);
    this.draft.set({ ...DEFAULT_SHIFT, daysOfWeek: [...DEFAULT_SHIFT.daysOfWeek] });
    this.formError.set('');
    this.showEditor.set(true);
  }

  openEdit(item: BranchShiftTemplate): void {
    if (!this.mayEdit() || this.busy()) return;
    this.editingId.set(item.id);
    this.draft.set({
      name: item.name || '',
      startTime: item.startTime,
      endTime: item.endTime,
      daysOfWeek: [...(item.daysOfWeek || [])],
      status: item.status === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
    });
    this.formError.set('');
    this.showEditor.set(true);
  }

  setField(key: 'name' | 'startTime' | 'endTime', value: string): void {
    this.draft.update(d => ({ ...d, [key]: value }));
    this.formError.set('');
  }

  setStatus(value: string): void {
    this.draft.update(d => ({ ...d, status: value === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE' }));
  }

  toggleDay(day: number, checked: boolean): void {
    this.draft.update(d => ({
      ...d, daysOfWeek: checked
        ? [...new Set([...d.daysOfWeek, day])]
        : d.daysOfWeek.filter(value => value !== day),
    }));
    this.formError.set('');
  }

  closeEditor(): void {
    if (!this.busy()) this.showEditor.set(false);
  }

  save(): void {
    if (!this.mayEdit() || this.busy() || !this.branchId) return;
    const body = this.draft();
    const timePattern = /^([01]\d|2[0-3]):[0-5]\d$/;
    if (body.name.trim().length < 2 || body.name.trim().length > 100) {
      this.formError.set('Tên ca cần có từ 2 đến 100 ký tự.');
      return;
    }
    if (!timePattern.test(body.startTime) || !timePattern.test(body.endTime) || body.startTime === body.endTime) {
      this.formError.set('Vui lòng chọn giờ bắt đầu và kết thúc hợp lệ, không trùng nhau.');
      return;
    }
    if (!body.daysOfWeek.length) {
      this.formError.set('Vui lòng chọn ít nhất một ngày áp dụng.');
      return;
    }
    const payload: BranchShiftTemplateWrite = {
      name: body.name.trim(),
      startTime: body.startTime,
      endTime: body.endTime,
      daysOfWeek: [...body.daysOfWeek].sort((a,b) => a-b),
      status: body.status,
    };
    const branch = this.branchId;
    const id = this.editingId();
    this.busy.set(true);
    this.formError.set('');
    const request = id
      ? this.api.updateShiftTemplate(branch, id, payload)
      : this.api.createShiftTemplate(branch, payload);
    request.pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false))).subscribe({
      next: () => {
        if (branch !== this.branchId) return;
        this.showEditor.set(false);
        this.notice.set(id ? 'Đã cập nhật ca làm việc.' : 'Đã thêm ca làm việc.');
        this.load();
      },
      error: error => this.formError.set(adminErrorMessage(error, 'Chưa lưu được ca làm việc. Vui lòng thử lại.')),
    });
  }

  requestDelete(item: BranchShiftTemplate): void {
    if (!this.mayEdit() || this.busy()) return;
    this.formError.set('');
    this.deleting.set(item);
  }

  cancelDelete(): void {
    if (!this.busy()) this.deleting.set(null);
  }

  confirmDelete(): void {
    const item = this.deleting();
    if (!item || !this.mayEdit() || this.busy() || !this.branchId) return;
    const branch = this.branchId;
    this.busy.set(true);
    this.formError.set('');
    this.api.deleteShiftTemplate(branch, item.id)
      .pipe(takeUntilDestroyed(this.destroyRef), finalize(() => this.busy.set(false)))
      .subscribe({
        next: () => {
          if (branch !== this.branchId) return;
          this.deleting.set(null);
          this.notice.set('Đã xóa ca làm việc.');
          this.load();
        },
        error: err => this.formError.set(adminErrorMessage(err, 'Chưa xóa được ca làm việc. Vui lòng thử lại.')),
      });
  }
}
