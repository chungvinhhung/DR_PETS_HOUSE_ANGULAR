import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { formatVnd } from '../../../../shared/customer/utils/currency';
import type { GuestOrder } from '../models/guest-lookup.models';
import {
  ORDER_STATUS_LABELS,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_LABELS,
  formatAddress,
  formatDateTime,
  labelOf,
  statusTone,
} from '../utils/guest-lookup-display';

/**
 * GuestOrderDetail — chi tiết đơn hàng Guest, chỉ hiển thị field có trong dữ liệu BE trả về.
 * Không có hủy / trả hàng: chưa có API cho Guest thực hiện các thao tác này.
 */
@Component({
  selector: 'article[app-guest-order-detail]',
  standalone: true,
  templateUrl: './guest-order-detail.component.html',
  styleUrl: './guest-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GuestOrderDetailComponent {
  readonly order = input.required<GuestOrder>();

  protected readonly ORDER_STATUS_LABELS = ORDER_STATUS_LABELS;
  protected readonly PAYMENT_METHOD_LABELS = PAYMENT_METHOD_LABELS;
  protected readonly PAYMENT_STATUS_LABELS = PAYMENT_STATUS_LABELS;
  protected readonly labelOf = labelOf;
  protected readonly statusTone = statusTone;
  protected readonly formatDateTime = formatDateTime;
  protected readonly formatVnd = formatVnd;

  protected readonly address = computed(() => formatAddress(this.order().shippingAddress));
  protected readonly recipient = computed(() => {
    const address = this.order().shippingAddress;
    return address?.recipientName || address?.fullName || '';
  });
}
