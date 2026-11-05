import { ChangeDetectionStrategy, Component, EventEmitter, Input, Output } from '@angular/core';

export type AdminDataStateKind = 'loading' | 'empty' | 'error' | 'technical';

@Component({
  selector: 'app-admin-data-state',
  standalone: true,
  templateUrl: './admin-data-state.component.html',
  styleUrl: './admin-data-state.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDataStateComponent {
  @Input({ required: true }) kind: AdminDataStateKind = 'empty';
  @Input() title = '';
  @Input() message = '';
  @Input() retryLabel = 'Thử lại';
  @Output() retry = new EventEmitter<void>();

  get displayTitle(): string {
    if (this.title) return this.title;
    if (this.kind === 'loading') return 'Đang tải dữ liệu';
    if (this.kind === 'error') return 'Không thể tải dữ liệu';
    if (this.kind === 'technical') return 'Chức năng chưa sẵn sàng';
    return 'Chưa có dữ liệu';
  }

  get displayMessage(): string {
    if (this.message) return this.message;
    if (this.kind === 'loading') return 'Vui lòng chờ trong giây lát.';
    if (this.kind === 'error') return 'Đã có lỗi xảy ra. Vui lòng thử lại.';
    if (this.kind === 'technical') return 'Chức năng này đang chờ hỗ trợ từ hệ thống.';
    return 'Hiện chưa có nội dung để hiển thị.';
  }
}
