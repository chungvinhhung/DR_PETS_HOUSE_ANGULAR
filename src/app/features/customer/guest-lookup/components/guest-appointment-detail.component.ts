import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { formatVnd } from '../../../../shared/customer/utils/currency';
import type { GuestAppointment } from '../models/guest-lookup.models';
import {
  APPOINTMENT_STATUS_LABELS,
  DEPOSIT_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  SERVICE_TYPE_LABELS,
  formatDateTime,
  labelOf,
  statusTone,
} from '../utils/guest-lookup-display';

/**
 * GuestAppointmentDetail — chi tiết lịch hẹn Guest, chỉ hiển thị field có trong dữ liệu BE trả về.
 * Không có đổi lịch / hủy lịch: chưa có API cho Guest thực hiện các thao tác này.
 */
@Component({
  selector: 'article[app-guest-appointment-detail]',
  standalone: true,
  templateUrl: './guest-appointment-detail.component.html',
  styleUrl: './guest-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuestAppointmentDetailComponent {
  readonly appointment = input.required<GuestAppointment>();
  /** Tên chi nhánh tra từ GET /branches (BE chỉ trả branchId). Rỗng thì ẩn dòng chi nhánh. */
  readonly branchName = input<string>('');

  protected readonly APPOINTMENT_STATUS_LABELS = APPOINTMENT_STATUS_LABELS;
  protected readonly DEPOSIT_STATUS_LABELS = DEPOSIT_STATUS_LABELS;
  protected readonly PAYMENT_METHOD_LABELS = PAYMENT_METHOD_LABELS;
  protected readonly SERVICE_TYPE_LABELS = SERVICE_TYPE_LABELS;
  protected readonly labelOf = labelOf;
  protected readonly statusTone = statusTone;
  protected readonly formatDateTime = formatDateTime;
  protected readonly formatVnd = formatVnd;
}
