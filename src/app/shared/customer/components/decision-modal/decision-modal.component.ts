import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';

import { DecisionModalService } from '../../../../core/customer/services/decision-modal.service';
import { WarningMarkComponent } from './warning-mark.component';

/**
 * Popup xác nhận Xóa / Hủy / Thành công — chuyển từ React: src/components/shared/DecisionModal.jsx
 *
 * Component chỉ lo hiển thị; nội dung & hành động lấy từ DecisionModalService.
 * Đã được đặt sẵn trong CustomerLayoutComponent, nơi khác chỉ cần gọi service:
 *   decisionModalService.confirmDelete({ onConfirm: () => ... })
 */
@Component({
  selector: 'app-decision-modal',
  standalone: true,
  imports: [WarningMarkComponent],
  templateUrl: './decision-modal.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DecisionModalComponent {
  protected readonly decisionModal = inject(DecisionModalService);

  protected readonly state = this.decisionModal.state;
  protected readonly isSuccess = computed(() => this.state().type === 'success');
}
