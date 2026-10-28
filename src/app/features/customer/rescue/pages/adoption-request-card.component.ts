import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { rescueImages } from '../../../../shared/customer/assets/rescue-images';

/**
 * AdoptionRequestCard — chuyển từ React: src/pages/Rescue/RescuePage.jsx
 */
@Component({
  selector: 'article[app-adoption-request-card]',
  standalone: true,
  imports: [],
  templateUrl: './adoption-request-card.component.html',
  host: {
    'class': 'flex min-h-[144px] items-center gap-5 rounded-[24px] border border-[#D9E3F6] bg-white px-5 py-5 shadow-[0_10px_30px_rgba(59,130,246,0.08)]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdoptionRequestCardComponent {
  // --- Input / Output (props của React) ---
  readonly request = input<any>(undefined);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly rescueImages: any = rescueImages;

  // --- Giá trị tính toán (computed) ---
  readonly badgeClass = computed<any>(() => this.request().status === "approved"
      ? "bg-[#D9F4E4] text-[#137333]"
      : this.request().status === "rejected"
        ? "bg-[#FFDAD6] text-[#BA1A1A]"
        : "bg-[#FFF9C4] text-[#715B00]");
  readonly submittedDate = computed<any>(() => this.request().submittedAt
    ? new Date(this.request().submittedAt).toLocaleDateString("vi-VN")
    : "");

}
