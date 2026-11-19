import { ChangeDetectionStrategy, Component, computed, effect, inject, input, output, signal, untracked } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

import { CustomerAuthService } from '../../../../core/customer/services/customer-auth.service';
import { UserApiService } from '../../../../core/customer/services/api/user-api.service';
import { SuccessViewComponent } from './success-view.component';
import { StepProgressComponent } from './step-progress.component';
import { CommitmentStepComponent } from './commitment-step.component';
import { ContactStepComponent } from './contact-step.component';
import { LivingStepComponent } from './living-step.component';
import { ModalButtonComponent } from './modal-button.component';
import { CustomerIconComponent } from '../../../../shared/customer/components/icon/customer-icon.component';
import { ADOPTION_STEPS } from '../data/adoption-form-data';
import { PROFILE_STORAGE_KEYS } from '../../../../core/customer/constants/user-profile-data';
import { NEW_ADDRESS_VALUE, initialFormValues, loadUserAddresses, getPrefilledValues, getMissingFields } from './adoption-application-modal.helpers';

/**
 * AdoptionApplicationModal — chuyển từ React: src/components/rescue/AdoptionApplicationModal.jsx
 */
@Component({
  selector: 'app-adoption-application-modal',
  standalone: true,
  imports: [NgTemplateOutlet, SuccessViewComponent, StepProgressComponent, CommitmentStepComponent, ContactStepComponent, LivingStepComponent, ModalButtonComponent, CustomerIconComponent],
  templateUrl: './adoption-application-modal.component.html',
  styleUrl: './adoption-application-modal.component.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdoptionApplicationModalComponent {
  // --- Service dùng chung ---
  protected readonly authService = inject(CustomerAuthService);
  protected readonly userApi = inject(UserApiService);

  // --- Input / Output (props của React) ---
  readonly open = input<any>(undefined);
  readonly pet = input<any>(undefined);
  readonly onClose = output<any>();
  readonly onSubmitApplication = output<any>();
  /** true khi component cha có truyền (onSubmitApplication) — thay cho kiểm tra "if (onSubmitApplication)" của React */
  readonly hasOnSubmitApplication = input<boolean>(false);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly getMissingFields: any = getMissingFields;

  // --- Giá trị tính toán (computed) ---
  readonly formTitle = computed<any>(() => {
    if (!this.pet()?.name) return this.currentStep().title;
    return this.currentStep().title;
  });
  readonly userId = computed<any>(() => this.authService.userProfile()?.userId);
  readonly currentStep = computed<any>(() => (ADOPTION_STEPS as any)[this.stepIndex()]);
  readonly isLastStep = computed<any>(() => this.stepIndex() === ADOPTION_STEPS.length - 1);

  // --- Trạng thái (signal = useState / useRef) ---
  readonly stepIndex = signal<any>(0);
  readonly values = signal<any>(initialFormValues);
  readonly addresses = signal<any>([]);
  readonly addressMode = signal<any>(NEW_ADDRESS_VALUE);
  readonly validationAttemptedByStep = signal<any>({});
  readonly submitted = signal<any>(false);
  readonly isSubmitting = signal<any>(false);
  readonly submitError = signal<any>("");

  constructor() {
    // useEffect(..., [open, isAuthenticated, userProfile, userId])
    effect((onCleanup: any) => {
      this.open();
      this.authService.isAuthenticated();
      this.authService.userProfile();
      this.userId();
      const cleanup = untracked(() => {
        if (!this.open()) return;
        let active = true;
        const nextAddresses = this.authService.isAuthenticated() ? loadUserAddresses() : [];
        const defaultAddress =
          nextAddresses.find((address: any) => address.isDefault) ?? nextAddresses[0];

        this.stepIndex.set(0);
        this.addresses.set(nextAddresses);
        this.addressMode.set(nextAddresses.length > 1 && defaultAddress?.id ? defaultAddress.id : NEW_ADDRESS_VALUE);
        this.values.set(getPrefilledValues({ isAuthenticated: this.authService.isAuthenticated(), userProfile: this.authService.userProfile(), addresses: nextAddresses }));
        this.validationAttemptedByStep.set({});
        this.submitted.set(false);
        this.isSubmitting.set(false);
        this.submitError.set("");
        document.body.style.overflow = "hidden";

        if (this.authService.isAuthenticated() && this.userId()) {
          this.userApi.getUserAddresses(this.userId())
            .then((apiAddresses: any) => {
              if (!active || !apiAddresses.length) return;
              const apiDefaultAddress =
                apiAddresses.find((address: any) => address.isDefault) ?? apiAddresses[0];

              this.addresses.set(apiAddresses);
              this.addressMode.set(apiAddresses.length > 1 && apiDefaultAddress?.id ? apiDefaultAddress.id : NEW_ADDRESS_VALUE);
              this.values.set(getPrefilledValues({ isAuthenticated: this.authService.isAuthenticated(), userProfile: this.authService.userProfile(), addresses: apiAddresses }));
              localStorage.setItem(PROFILE_STORAGE_KEYS.addresses, JSON.stringify(apiAddresses));
            })
            .catch(() => {
              // Local addresses are already loaded as a fallback.
            });
        }

        return () => {
          active = false;
          document.body.style.overflow = "";
        };
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });
  }

  protected handleChange(name: any, value: any) {
    this.values.update((current: any) => ({ ...current, [name]: value }));
  }

  protected async handleNext(event: any) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const missingFields = getMissingFields(this.values(), this.currentStep().id);
    if (missingFields.length > 0) {
      this.validationAttemptedByStep.update((current: any) => ({ ...current, [this.currentStep().id]: true }));
      window.setTimeout(() => {
        (formElement.querySelector('[data-adoption-error="true"]') as any)?.focus();
      }, 0);
      return;
    }

    if (this.isLastStep()) {
      this.submitError.set("");
      this.isSubmitting.set(true);
      try {
        if (this.hasOnSubmitApplication()) {
          await this.onSubmitApplication.emit(this.values());
        }
        this.submitted.set(true);
      } catch (error: any) {
        this.submitError.set(error?.message || "Không thể gửi đơn nhận nuôi.");
      } finally {
        this.isSubmitting.set(false);
      }
      return;
    }
    this.validationAttemptedByStep.update((current: any) => ({ ...current, [this.currentStep().id]: false }));
    this.stepIndex.update((index: any) => index + 1);
  }

  protected handle1() {
    this.stepIndex.update((index: any) => index - 1);
  }
}
