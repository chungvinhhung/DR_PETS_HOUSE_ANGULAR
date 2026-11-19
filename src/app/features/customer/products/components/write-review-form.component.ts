import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';

import { CustomerAuthService } from '../../../../core/customer/services/customer-auth.service';
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
  styleUrl: './write-review-form.component.scss',
  host: {
    '(submit)': 'handleSubmit($any($event))',
    'class': 'flex w-full flex-col gap-5 rounded-[14px] border border-solid border-[#d3d3d3] bg-white py-[34px] pl-4 pr-4 sm:flex-row sm:pr-[31px]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class WriteReviewFormComponent {
  private readonly authService = inject(CustomerAuthService);

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

  readonly loggedInUserName = computed<string>(() => {
    const user = (this.authService as any).currentUser?.() || (this.authService as any).user?.();
    return user?.fullName || user?.full_name || user?.name || '';
  });

  // --- Trạng thái (signal = useState / useRef) ---
  readonly rating = signal<any>(0);
  readonly name = signal<any>("");
  readonly review = signal<any>("");
  readonly isAnonymous = signal<boolean>(false);

  constructor() {
    effect(() => {
      const defaultName = this.loggedInUserName();
      untracked(() => {
        if (defaultName && !this.name()) {
          this.name.set(defaultName);
        }
      });
    });
  }

  protected handleNameInput(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value);
  }

  protected toggleAnonymous(): void {
    this.isAnonymous.update((prev) => !prev);
  }

  protected handleSubmit(event: any) {
    event.preventDefault();
    const submittedName = this.isAnonymous()
      ? 'Khách hàng ẩn danh'
      : (this.name().trim() || this.loggedInUserName() || 'Khách hàng');

    this.onSubmit.emit({
      targetType: this.targetType(),
      targetId: this.targetId(),
      targetName: this.targetName(),
      appointmentId: this.appointmentId(),
      name: submittedName,
      isAnonymous: this.isAnonymous(),
      rating: this.rating(),
      review: this.review(),
    });
  }
}
