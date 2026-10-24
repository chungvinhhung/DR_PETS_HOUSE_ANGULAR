import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  OnInit,
  Output,
  ViewChild,
  inject,
  signal,
} from '@angular/core';

import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { BranchManagementApiService } from '../../branch-management/services/branch-management-api.service';
import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { AdminToastService } from '../../../../shared/services/admin-toast.service';
import { CatalogBranch, CatalogService } from '../models/service-catalog.model';

export interface BlockedWindow {
  id: string | number;
  start: string;
  end: string;
  reason: string;
}
export interface BranchServiceConfigPreview {
  serviceId: string;
  branchId: string;
  capacity: number;
  enabled: boolean;
  blockedWindows: readonly BlockedWindow[];
}

/**
 * Phase 3 BranchService preview — opened ONLY from Branch Detail.
 * No Backend writes. Availability is computed by BE, never manually configured.
 */
@Component({
  selector: 'app-branch-service-config-dialog',
  standalone: true,
  templateUrl: './branch-service-config-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchServiceConfigDialogComponent implements OnInit, AfterViewInit {
  private readonly session = inject(AuthSessionService);
  private readonly api = inject(BranchManagementApiService);
  private readonly toast = inject(AdminToastService);

  @Input({ required: true }) service!: CatalogService;
  @Input({ required: true }) branches: readonly CatalogBranch[] = [];
  @Input({ required: true }) initialBranchId = '';

  @Output() readonly dismiss = new EventEmitter<void>();
  @Output() readonly previewSaved = new EventEmitter<BranchServiceConfigPreview>();
  @Input() initialBlockedWindows: readonly BlockedWindow[] | null = null;
  @Input() saving = false;
  @Input() draftMode = false;
  @Input() branchActive = true;
  @ViewChild('dialog') private dialogRef?: ElementRef<HTMLElement>;

  readonly selectedBranchId = signal('');
  readonly capacity = signal(0);
  readonly enabled = signal(false);
  readonly blockedWindows = signal<readonly BlockedWindow[]>([]);
  readonly blockStart = signal('');
  readonly blockEnd = signal('');
  readonly blockReason = signal('');
  readonly showBlockForm = signal(false);
  readonly blocksLoading = signal(false);
  readonly blocksSaving = signal(false);
  readonly blocksError = signal('');
  readonly editingBlockedId = signal<string | number | null>(null);
  readonly dirty = signal(false);
  readonly feedback = signal('');
  readonly errors = signal<string[]>([]);
  readonly confirmDiscard = signal(false);
  readonly isManager = this.session.user()?.systemRole === 'MANAGER';
  private nextBlockedId = 1;

  get isServiceActive(): boolean {
    return this.service.status === 'ACTIVE';
  }

  get selectedBranch(): CatalogBranch | undefined {
    return this.branches.find((branch) => branch.id === this.selectedBranchId());
  }

  get canEnable(): boolean {
    return this.isServiceActive && this.branchActive && this.capacity() > 0;
  }

  ngOnInit(): void {
    const branch = this.branches.find((item) => item.id === this.initialBranchId);
    if (!branch) {
      this.errors.set(['Chi nhánh không hợp lệ hoặc không nằm trong phạm vi được phép.']);
      return;
    }
    const current = this.service.branchServices.find((entry) => entry.branchId === branch.id);
    const count = current?.capacity ?? 0;
    this.selectedBranchId.set(branch.id);
    this.capacity.set(Math.max(0, count));
    this.enabled.set(this.isServiceActive && count > 0 && (current?.enabled ?? false));
    // Draft services have no server ID. Their blocks can only be configured after creation.
    if (!this.draftMode && this.service.id !== '__unsaved_service__') this.loadBlocks();
    else this.blockedWindows.set([]);

  }

  private localDateTime(iso: string): string {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000)
      .toISOString().slice(0, 16);
  }

  loadBlocks(): void {
    if (this.draftMode) return;
    this.blocksLoading.set(true);
    this.blocksError.set('');
    this.api.listTemporaryBlocks(this.initialBranchId, this.service.id).subscribe({
      next: (result) => {
        this.blockedWindows.set(result.blockedWindows.map((b) => ({
          id: b.id, start: this.localDateTime(b.startAt),
          end: this.localDateTime(b.endAt), reason: b.reason,
        })));
        this.blocksLoading.set(false);
      },
      error: () => {
        this.blocksLoading.set(false);
        this.blocksError.set('Không tải được các khoảng tạm khóa. Vui lòng thử lại.');
      },
    });
  }

  ngAfterViewInit(): void {
    this.dialogRef?.nativeElement.focus();
  }

  decrease(): void {
    this.updateCapacity(this.capacity() - 1);
  }

  increase(): void {
    this.updateCapacity(this.capacity() + 1);
  }

  updateCapacity(raw: number): void {
    const count = Number.isFinite(raw) ? Math.max(0, Math.min(100, Math.trunc(raw))) : 0;
    this.capacity.set(count);
    if (count === 0) this.enabled.set(false);
    this.markChanged();
  }

  toggleEnabled(): void {
    if (!this.enabled() && !this.canEnable) return;
    this.enabled.update((old) => !old);
    this.markChanged();
  }

  updateStart(value: string): void {
    this.blockStart.set(value);
    this.markChanged();
  }

  updateEnd(value: string): void {
    this.blockEnd.set(value);
    this.markChanged();
  }

  updateReason(value: string): void {
    this.blockReason.set(value);
    this.markChanged();
  }

  startAddingBlockedWindow(): void {
    this.showBlockForm.set(true);
    this.editingBlockedId.set(null);
    this.blockStart.set('');
    this.blockEnd.set('');
    this.blockReason.set('');
    this.errors.set([]);
  }

  editBlockedWindow(id: string | number): void {
    if (typeof id === 'string') {
      this.toast.show('Để thay đổi khoảng đã lưu, hãy xóa khoảng cũ rồi thêm khoảng mới.', 'info');
      return;
    }
    const selected = this.blockedWindows().find((item) => item.id === id);
    if (!selected) return;
    this.blockStart.set(selected.start);
    this.blockEnd.set(selected.end);
    this.blockReason.set(selected.reason);
    this.editingBlockedId.set(id);
    this.showBlockForm.set(true);
    this.errors.set([]);
  }

  cancelBlockedWindow(): void {
    this.showBlockForm.set(false);
    this.editingBlockedId.set(null);
    this.blockStart.set('');
    this.blockEnd.set('');
    this.blockReason.set('');
    this.errors.set([]);
  }

  formatWindow(window: BlockedWindow): string {
    const date = (stamp: string): string => stamp.slice(0, 10).split('-').reverse().join('/');
    const startDate = date(window.start);
    const endDate = date(window.end);
    const startTime = window.start.slice(11, 16);
    const endTime = window.end.slice(11, 16);
    return startDate === endDate
      ? startDate + ', ' + startTime + '–' + endTime
      : startDate + ' ' + startTime + ' – ' + endDate + ' ' + endTime;
  }

  private validWindow(start: string, end: string): boolean {
    const from = new Date(start).getTime();
    const to = new Date(end).getTime();
    return !!start && !!end && Number.isFinite(from) && Number.isFinite(to) && to > from;
  }

  addBlockedWindow(): void {
    const start = this.blockStart();
    const end = this.blockEnd();
    const reason = this.blockReason().trim();
    if (!reason) {
      this.errors.set(['Vui lòng nhập lý do tạm khóa.']);
      this.toast.show('Vui lòng nhập lý do tạm khóa.', 'error');
      return;
    }
    if (!this.validWindow(start, end)) {
      this.errors.set(['Khoảng tạm khóa phải có ngày/giờ kết thúc sau ngày/giờ bắt đầu.']);
      this.toast.show('Ngày/giờ tạm khóa không hợp lệ.', 'error');
      return;
    }
    const first = new Date(start).getTime();
    const last = new Date(end).getTime();
    const overlaps = this.blockedWindows().some((window) =>
      window.id !== this.editingBlockedId() && first < new Date(window.end).getTime() && last > new Date(window.start).getTime(),
    );
    if (overlaps) {
      this.errors.set(['Khoảng tạm khóa mới bị trùng với khoảng đã nhập.']);
      return;
    }
    if (this.draftMode || this.service.id === '__unsaved_service__') {
      this.toast.show('Vui lòng lưu dịch vụ trước khi tạo khoảng tạm khóa.', 'info');
      return;
    }
    if (this.blocksSaving()) return;
    this.blocksSaving.set(true);
    this.api.createTemporaryBlock(this.initialBranchId, this.service.id, {
      startAt: new Date(start).toISOString(),
      endAt: new Date(end).toISOString(),
      reason,
    }).subscribe({
      next: (created) => {
        this.blockedWindows.update((windows) => [...windows, {
          id: created.id, start: this.localDateTime(created.startAt),
          end: this.localDateTime(created.endAt), reason: created.reason,
        }].sort((x, y) => x.start.localeCompare(y.start)));
        this.blockStart.set('');
        this.blockEnd.set('');
        this.blockReason.set('');
        this.editingBlockedId.set(null);
        this.showBlockForm.set(false);
        this.blocksSaving.set(false);
        this.toast.show('Đã thêm khoảng tạm khóa.', 'success');
      },
      error: (error: unknown) => {
        this.blocksSaving.set(false);
        const status = (error as { status?: number })?.status;
        this.toast.show(status === 409
          ? 'Không thể tạm khóa vì có lịch hẹn đã xác nhận trong khoảng giờ này.'
          : 'Không thêm được khoảng tạm khóa. Vui lòng thử lại.', 'error');
      },
    });
  }

  removeBlockedWindow(id: string | number): void {
    if (typeof id !== 'string' || this.blocksSaving()) return;
    this.blocksSaving.set(true);
    this.api.deleteTemporaryBlock(this.initialBranchId, this.service.id, id).subscribe({
      next: () => {
        this.blockedWindows.update((windows) => windows.filter((window) => window.id !== id));
        this.blocksSaving.set(false);
        this.toast.show('Đã gỡ khoảng tạm khóa.', 'success');
      },
      error: () => {
        this.blocksSaving.set(false);
        this.toast.show('Không gỡ được khoảng tạm khóa. Vui lòng thử lại.', 'error');
      },
    });
  }

  private markChanged(): void {
    this.dirty.set(true);
    this.feedback.set('');
    this.errors.set([]);
  }

  validatePreview(): void {
    const errors: string[] = [];
    if (!this.selectedBranch) {
      errors.push('Không tìm thấy chi nhánh hợp lệ.');
    }
    if (!Number.isInteger(this.capacity()) || this.capacity() < 1) {
      errors.push('Sức chứa đồng thời phải là số nguyên từ 1 trở lên.');
    }
    if (this.enabled() && !this.canEnable) {
      errors.push('Không thể bật dịch vụ khi chi nhánh ngừng hoạt động, dịch vụ tạm ngưng hoặc sức chứa bằng 0.');
    }
    if (this.blockStart() || this.blockEnd() || this.blockReason()) {
      errors.push('Bạn còn khoảng tạm khóa đang nhập dở. Hãy thêm hoặc xóa dữ liệu vừa nhập.');
    }
    for (const window of this.blockedWindows()) {
      if (!this.validWindow(window.start, window.end)) {
        errors.push('Có khoảng tạm khóa không hợp lệ.');
      }
    }
    this.errors.set(errors);
    if (errors.length) {
      this.toast.show(errors[0], 'error');
      this.feedback.set('');
      return;
    }
    this.previewSaved.emit({
      serviceId: this.service.id,
      branchId: this.selectedBranchId(),
      enabled: this.enabled(),
      capacity: this.capacity(),
      blockedWindows: this.blockedWindows().map((window) => ({ ...window })),
    });
  }

  requestClose(): void {
    if (this.saving || this.blocksSaving()) return;
    if (this.dirty()) {
      this.confirmDiscard.set(true);
    } else {
      this.dismiss.emit();
    }
  }

  discardChanges(): void {
    this.dismiss.emit();
  }

  cancelDiscard(): void {
    this.confirmDiscard.set(false);
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    if (this.confirmDiscard()) {
      this.confirmDiscard.set(false);
      return;
    }
    this.requestClose();
  }

  @HostListener('document:keydown.tab', ['$event'])
  trapFocus(event: Event): void {
    if (!this.dialogRef) return;
    const keyboardEvent = event as KeyboardEvent;
    const root = this.dialogRef.nativeElement;
    const focusables = Array.from(root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), [tabindex="0"]',
    )).filter((element) => element.getClientRects().length > 0);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (keyboardEvent.shiftKey && (active === first || active === root)) {
      keyboardEvent.preventDefault();
      last.focus();
    } else if (!keyboardEvent.shiftKey && (active === last || active === root)) {
      keyboardEvent.preventDefault();
      first.focus();
    }
  }
}
