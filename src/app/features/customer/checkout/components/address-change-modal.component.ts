import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

import { AddressFormModalComponent } from '../../../../shared/customer/components/address-form-modal/address-form-modal.component';
import { AddressListComponent } from './address-list.component';
import { checkoutImages } from '../assets/checkout-assets';

/**
 * AddressChangeModal — chuyển từ React: src/components/checkout/ShoppingCheckout.jsx
 */
@Component({
  selector: 'app-address-change-modal',
  standalone: true,
  imports: [AddressFormModalComponent, AddressListComponent],
  templateUrl: './address-change-modal.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddressChangeModalComponent {
  // --- Input / Output (props của React) ---
  readonly addresses = input<any>(undefined);
  readonly onClose = output<any>();
  readonly onSave = output<any>();
  readonly onSelect = output<any>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly checkoutImages: any = checkoutImages;

  // --- Trạng thái (signal = useState / useRef) ---
  readonly mode = signal<any>("list");
  readonly editingAddress = signal<any>(null);
  readonly saveError = signal<any>("");

  protected openForm(address: any) {
    this.editingAddress.set(address ?? null);
    this.mode.set(address ? "edit" : "add");
  }

  protected async handle1(address: any) {
    try {
      this.saveError.set("");
      await this.onSave.emit(address);
      this.mode.set("list");
    } catch (error: any) {
      this.saveError.set(error?.message || "Không thể lưu địa chỉ");
    }
  }

  protected handle2(event: any) { if (event.target === event.currentTarget) this.onClose.emit(undefined); }
}
