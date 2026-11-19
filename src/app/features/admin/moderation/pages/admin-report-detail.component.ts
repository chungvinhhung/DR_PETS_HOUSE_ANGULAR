import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { finalize } from 'rxjs';

import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminBreadcrumbComponent } from '../../../../shared/admin-breadcrumb/admin-breadcrumb.component';
import { AdminDataStateComponent } from '../../../../shared/admin-data-state/admin-data-state.component';
import { AdminModerationService } from '../services/admin-moderation.service';

@Component({
  selector: 'app-admin-report-detail',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    AdminCatalogShellComponent,
    AdminBreadcrumbComponent,
    AdminDataStateComponent,
  ],
  templateUrl: './admin-report-detail.component.html',
  styleUrl: './admin-report-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminReportDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(AdminModerationService);

  readonly data = signal<any | null>(null);
  readonly loading = signal(true);
  readonly error = signal('');
  readonly busy = signal(false);
  readonly actionPanel = signal(false);
  readonly selectedDecision = signal<'HIDE_POST' | 'NO_VIOLATION' | ''>('');
  readonly moderationNote = signal('');
  readonly success = signal('');
  readonly id = this.route.snapshot.paramMap.get('id') || '';

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api
      .getReport(this.id)
      .pipe(finalize(() => this.loading.set(false)))
      .subscribe({
        next: (v) => this.data.set(v),
        error: () => this.error.set('Không thể tải chi tiết báo cáo vi phạm.'),
      });
  }

  canAction(): boolean {
    const status = String(this.data()?.status || '').toUpperCase();
    return status === 'PENDING' || status === 'UNDER_REVIEW';
  }

  startResolve(decision: 'HIDE_POST' | 'NO_VIOLATION'): void {
    if (this.busy() || !this.canAction()) return;
    this.selectedDecision.set(decision);
    this.actionPanel.set(true);
    this.moderationNote.set('');
    this.error.set('');
    this.success.set('');
  }

  cancelResolve(): void {
    if (!this.busy()) {
      this.actionPanel.set(false);
      this.selectedDecision.set('');
    }
  }

  submitResolve(): void {
    const decision = this.selectedDecision();
    if (!decision || this.busy()) return;

    this.busy.set(true);
    this.error.set('');
    this.success.set('');

    this.api
      .resolveReport(this.id, decision, this.moderationNote().trim())
      .pipe(finalize(() => this.busy.set(false)))
      .subscribe({
        next: (res) => {
          const updated = res?.data || res;
          this.data.set({ ...this.data(), ...updated });
          this.actionPanel.set(false);
          this.selectedDecision.set('');
          this.moderationNote.set('');
          const msg =
            decision === 'HIDE_POST'
              ? 'Đã ẩn bài đăng vi phạm thành công.'
              : 'Đã xác nhận bài đăng không vi phạm.';
          this.success.set(msg);
        },
        error: (err) => {
          this.error.set(
            err?.error?.message || 'Không thể xử lý báo cáo vi phạm.'
          );
        },
      });
  }

  reasonLabel(reason: string): string {
    const map: Record<string, string> = {
      SPAM: 'Spam / quảng cáo',
      MISINFORMATION: 'Thông tin sai lệch',
      INAPPROPRIATE: 'Nội dung không phù hợp',
      HARASSMENT: 'Quấy rối / xúc phạm',
      OTHER: 'Khác',
    };
    return map[String(reason || '').toUpperCase()] || reason || '—';
  }

  statusLabel(status: string): string {
    const s = String(status || '').toUpperCase();
    const map: Record<string, string> = {
      PENDING: 'Chờ xử lý',
      UNDER_REVIEW: 'Đang xem xét',
      RESOLVED: 'Đã xử lý (Đã ẩn bài)',
      NO_VIOLATION: 'Không vi phạm',
    };
    return map[s] || s;
  }

  statusKind(status: string): string {
    const s = String(status || '').toUpperCase();
    if (s === 'RESOLVED') return 'danger';
    if (s === 'NO_VIOLATION') return 'success';
    if (s === 'UNDER_REVIEW') return 'info';
    return 'pending';
  }

  date(v: any): string {
    if (!v) return '—';
    const d = new Date(v);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('vi-VN');
  }
}
