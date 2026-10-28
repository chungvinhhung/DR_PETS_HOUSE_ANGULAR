import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

import { buttonShadow } from './adoption-application-modal.helpers';

/**
 * ModalButton — chuyển từ React: src/components/rescue/AdoptionApplicationModal.jsx
 */
@Component({
  selector: 'app-modal-button',
  standalone: true,
  imports: [],
  templateUrl: './modal-button.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModalButtonComponent {
  // --- Input / Output (props của React) ---
  readonly variant = input<any>("primary");
  readonly className = input<any>("");
  readonly onClick = output<any>();
  readonly type = input<any>(undefined);
  readonly disabled = input<any>(undefined);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly buttonShadow: any = buttonShadow;

  // --- Giá trị tính toán (computed) ---
  readonly variants = computed<any>(() => ({
    primary: "bg-[#FDD835] text-[rgba(0,0,0,0.87)] hover:bg-[#FBC02D]",
    light: "bg-[#FFF9C4] text-black hover:bg-[#FFF59D]",
    danger: "bg-[#D32F2F] text-white hover:bg-[#C62828]",
    outline: "border border-[#FDD835] bg-white text-black hover:bg-[#FFFDE7]",
  }));

}
