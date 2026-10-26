import { ChangeDetectionStrategy, Component, inject } from '@angular/core';

import { CartService } from '../../../../core/customer/services/cart.service';
import { BANK_TRANSFER_INFO, bankTransferImages } from '../assets/bank-transfer-assets';

/**
 * BankTransferModal — chuyển từ React: src/components/checkout/BankTransferModal.jsx
 */
@Component({
  selector: 'app-bank-transfer-modal',
  standalone: true,
  imports: [],
  templateUrl: './bank-transfer-modal.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BankTransferModalComponent {
  // --- Service dùng chung ---
  protected readonly cartService = inject(CartService);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly bankTransferImages: any = bankTransferImages;
  protected readonly BANK_TRANSFER_INFO: any = BANK_TRANSFER_INFO;

  protected async handleCopyAccount() {
    try {
      await navigator.clipboard.writeText(BANK_TRANSFER_INFO.accountNumber);
    } catch {
      /* clipboard unavailable */
    }
  }
}
