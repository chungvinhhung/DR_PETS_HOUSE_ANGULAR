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

import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { AdminToastService } from '../../../../shared/services/admin-toast.service';
import { CatalogBranch, CatalogService } from '../models/service-catalog.model';

export interface BlockedWindow {
  id: number;
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
  private readonly toast = inject(AdminToastService);

  @Input({ required: true }) service!: CatalogService;
  @Input({ required: true }) branches: readonly CatalogBranch[] = [];
  @Input({ required: true }) initialBranchId = '';

  @Output() readonly dismiss = new EventEmitter<void>();
  @Output() readonly previewSaved = new EventEmitter<BranchServiceConfigPreview>();
  @Input() initialBlockedWindows: readonly BlockedWindow[] | null = null;
  @ViewChild('dialog') private dialogRef?: ElementRef<HTMLElement>;

  readonly selectedBranchId = signal('');
  readonly capacity = signal(0);
  readonly enabled = signal(false);
  readonly blockedWindows = signal<readonly BlockedWindow[]>([]);
  readonly blockStart = signal('');
  readonly blockEnd = signal('');
  readonly blockReason = signal('');
  readonly showBlockForm = signal(false);
  readonly editingBlockedId = signal<number | null>(null);
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
    return this.isServiceActive && this.capacity() > 0;
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
    // Empty until the BE exposes per-service blocked windows. Do not invent existing periods.
    if (this.initialBlockedWindows) {
      this.blockedWindows.set(this.initialBlockedWindows.map((window) => ({ ...window })));
      this.nextBlockedId = Math.max(0, ...this.initialBlockedWindows.map((window) => window.id)) + 1;
      this.showBlockForm.set(false);
    } else if (branch.id === 'demo-q1') {
      // Figma V2 illustrations only, not fetched or persisted.
      this.blockedWindows.set([
        { id: 1, start: '2026-10-22T13:00', end: '2026-10-22T15:00', reason: 'Bảo trì khu tắm' },
        { id: 2, start: '2026-10-24T08:00', end: '2026-10-24T12:00', reason: 'Vệ sinh thiết bị' },
      ]);
      this.nextBlockedId = 3;
      this.showBlockForm.set(true);
    } else this.blockedWindows.set([]);
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
    if (!this.canEnable) return;
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

  editBlockedWindow(id: number): void {
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
    const id = this.editingBlockedId() ?? this.nextBlockedId++;
    this.blockedWindows.update((windows) => [
      ...windows.filter((window) => window.id !== id),
      { id, start, end, reason },
    ].sort((a, b) => a.start.localeCompare(b.start)));
    this.blockStart.set('');
    this.blockEnd.set('');
    this.blockReason.set('');
    this.editingBlockedId.set(null);
    this.showBlockForm.set(false);
    this.markChanged();
  }

  removeBlockedWindow(id: number): void {
    this.blockedWindows.update((windows) => windows.filter((window) => window.id !== id));
    this.markChanged();
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
    if (!Number.isInteger(this.capacity()) || this.capacity() < 0) {
      errors.push('Sức chứa phải là số nguyên không âm.');
    }
    if (this.enabled() && !this.canEnable) {
      errors.push('Không thể bật khi capacity bằng 0 hoặc dịch vụ tạm ngưng.');
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
    this.dismiss.emit();
  }

  requestClose(): void {
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
