import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import { StarRatingComponent } from './star-rating.component';
import { productImages } from '../../../../shared/customer/assets/product-images';

/**
 * WriteReviewForm — chuyển từ React: src/components/product/WriteReviewForm.jsx
 */
@Component({
  selector: 'form[app-write-review-form]',
  standalone: true,
  imports: [StarRatingComponent],
  templateUrl: './write-review-form.component.html',
  host: {
    '(submit)': 'handleSubmit($any($event))',
    'class': 'flex w-full flex-col gap-5 rounded-[14px] border border-solid border-[#d3d3d3] bg-white py-[34px] pl-4 pr-4 sm:flex-row sm:pr-[31px]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WriteReviewFormComponent {
  // --- Input / Output (props của React) ---
  readonly targetType = input<any>("product");
  readonly targetId = input<any>(undefined);
  readonly targetName = input<any>("");
  readonly appointmentId = input<any>(undefined);
  readonly onSubmit = output<any>();

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly productImages: any = productImages;

  // --- Giá trị tính toán (computed) ---
  readonly targetLabel = computed<any>(() => this.targetType() === "service" ? "Dịch vụ" : "Sản phẩm");

  // --- Trạng thái (signal = useState / useRef) ---
  readonly rating = signal<any>(0);
  readonly name = signal<any>("");
  readonly review = signal<any>("");

  protected handleSubmit(event: any) {
    event.preventDefault();
    this.onSubmit.emit({
      targetType: this.targetType(),
      targetId: this.targetId(),
      targetName: this.targetName(),
      appointmentId: this.appointmentId(),
      name: this.name(),
      rating: this.rating(),
      review: this.review(),
    });
  }
}
