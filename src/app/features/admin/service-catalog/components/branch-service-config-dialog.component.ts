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
import {
  BranchAvailability,
  CatalogBranch,
  CatalogService,
} from '../models/service-catalog.model';

/**
 * Phase 3 UI preview. Never call a write API or indicate that data was persisted.
 * Real branch scope and edit permissions MUST be enforced by the backend.
 */
@Component({
  selector: 'app-branch-service-config-dialog',
  standalone: true,
  templateUrl: './branch-service-config-dialog.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchServiceConfigDialogComponent implements OnInit, AfterViewInit {
  private readonly session = inject(AuthSessionService);

  @Input({ required: true }) service!: CatalogService;
  @Input({ required: true }) branches: readonly CatalogBranch[] = [];
  @Input() initialBranchId = 'ALL';

  @Output() readonly dismiss = new EventEmitter<void>();

  @ViewChild('dialog') private dialogRef?: ElementRef<HTMLElement>;

  readonly selectedBranchId = signal('');
  readonly capacity = signal(0);
  readonly enabled = signal(false);
  readonly availability = signal<BranchAvailability>('BY_SHIFT');
  readonly dirty = signal(false);
  readonly feedback = signal('');
  readonly errors = signal<string[]>([]);
  readonly confirmDiscard = signal(false);

  readonly isManager = this.session.user()?.systemRole === 'MANAGER';

  get isServiceActive(): boolean {
    return this.service.status === 'ACTIVE';
  }

  get selectedBranch(): CatalogBranch | undefined {
    return this.branches.find((branch) => branch.id === this.selectedBranchId());
  }

  get branchPickerVisible(): boolean {
    return this.initialBranchId === 'ALL' && this.branches.length > 1;
  }

  get requiresContact(): boolean {
    return this.service.bookingMode === 'CONTACT_ONLY';
  }

  get canEnable(): boolean {
    return this.isServiceActive && this.capacity() > 0;
  }

  ngOnInit(): void {
    const initial = this.branches.some((b) => b.id === this.initialBranchId)
      ? this.initialBranchId
      : (this.branches[0]?.id ?? '');
    this.loadBranch(initial);
  }

  ngAfterViewInit(): void {
    this.dialogRef?.nativeElement.focus();
  }

  private loadBranch(branchId: string): void {
    if (!this.branches.some((branch) => branch.id === branchId)) return;

    const current = this.service.branchServices.find((config) => config.branchId === branchId);
    const capacity = current?.capacity ?? 0;
    this.selectedBranchId.set(branchId);
    this.capacity.set(Math.max(0, capacity));
    this.enabled.set(
      this.isServiceActive && capacity > 0 && (current?.enabled ?? false),
    );
    this.availability.set(
      this.requiresContact ? 'CONTACT' : (current?.availability ?? 'BY_SHIFT'),
    );
    this.dirty.set(false);
    this.feedback.set('');
    this.errors.set([]);
    this.confirmDiscard.set(false);
  }

  changeBranch(branchId: string): void {
    // Keep the unsaved draft visible; switching branches must not silently discard it.
    if (branchId === this.selectedBranchId()) return;
    if (this.dirty()) {
      this.errors.set(['Hãy hủy thay đổi hoặc kiểm tra bản xem trước trước khi chuyển chi nhánh.']);
      return;
    }
    this.loadBranch(branchId);
  }

  decrease(): void {
    this.updateCapacity(this.capacity() - 1);
  }

  increase(): void {
    this.updateCapacity(this.capacity() + 1);
  }

  updateCapacity(raw: number): void {
    const capacity = Number.isFinite(raw) ? Math.max(0, Math.min(100, Math.trunc(raw))) : 0;
    this.capacity.set(capacity);
    if (capacity === 0) this.enabled.set(false);
    this.markChanged();
  }

  setAvailability(mode: string): void {
    if (this.requiresContact) return;
    if (mode !== 'BY_SHIFT' && mode !== 'CONTACT') return;
    this.availability.set(mode);
    this.markChanged();
  }

  toggleEnabled(): void {
    if (!this.canEnable) return;
    this.enabled.update((value) => !value);
    this.markChanged();
  }

  private markChanged(): void {
    this.dirty.set(true);
    this.feedback.set('');
    this.errors.set([]);
  }

  validatePreview(): void {
    const errors: string[] = [];
    const branchId = this.selectedBranchId();
    if (!this.branches.some((b) => b.id === branchId)) {
      errors.push('Vui lòng chọn một chi nhánh trong phạm vi được phép.');
    }
    if (!Number.isInteger(this.capacity()) || this.capacity() < 0) {
      errors.push('Sức chứa phải là số nguyên không âm.');
    }
    if (this.enabled() && this.capacity() === 0) {
      errors.push('Sức chứa bằng 0 phải tắt kích hoạt tại chi nhánh.');
    }
    if (this.enabled() && !this.isServiceActive) {
      errors.push('Dịch vụ đang tạm ngưng toàn hệ thống nên không thể bật ở chi nhánh.');
    }
    if (this.requiresContact && this.availability() !== 'CONTACT') {
      errors.push('Dịch vụ CONTACT_ONLY phải chọn khả dụng Liên hệ.');
    }
    this.errors.set(errors);
    if (errors.length) {
      this.feedback.set('');
      return;
    }
    this.feedback.set(
      'Cấu hình hợp lệ (bản xem trước). Chưa lưu vào Backend vì API BranchService chưa được bàn giao.',
    );
  }

  requestClose(): void {
    if (this.dirty()) {
      this.confirmDiscard.set(true);
      return;
    }
    this.dismiss.emit();
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
    const keyboardEvent = event as KeyboardEvent;
    if (!this.dialogRef) return;
    const root = this.dialogRef.nativeElement;
    const focusables = Array.from(root.querySelectorAll<HTMLElement>(
      'button:not([disabled]), select:not([disabled]), input:not([disabled]), [tabindex="0"]',
    )).filter((node) => node.getClientRects().length > 0);
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
