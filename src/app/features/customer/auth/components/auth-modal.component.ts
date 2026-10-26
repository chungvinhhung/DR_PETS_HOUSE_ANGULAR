import { ChangeDetectionStrategy, Component, computed, effect, inject, signal, untracked } from '@angular/core';

import { CustomerAuthService } from '../../../../core/customer/services/customer-auth.service';
import { SplitSideComponent } from './split-side.component';
import { LoginFormComponent } from './login-form.component';
import { RegisterFormComponent } from './register-form.component';
import { SuccessPanelComponent } from './success-panel.component';
import { RecoveryPanelComponent } from './recovery-panel.component';
import { CustomerIconComponent } from '../../../../shared/customer/components/icon/customer-icon.component';
import { reactSetter } from '../../../../shared/customer/utils/react-setter';
import { EMPTY_FORMS } from './auth-modal.helpers';

/**
 * AuthModal — chuyển từ React: src/components/auth/AuthModal.jsx
 */
@Component({
  selector: 'app-auth-modal',
  standalone: true,
  imports: [SplitSideComponent, LoginFormComponent, RegisterFormComponent, SuccessPanelComponent, RecoveryPanelComponent, CustomerIconComponent],
  templateUrl: './auth-modal.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthModalComponent {
  // --- Service dùng chung ---
  protected readonly authService = inject(CustomerAuthService);

  // --- Giá trị tính toán (computed) ---
  readonly isSplit = computed<any>(() => this.authService.authModal() === "login" || this.authService.authModal() === "register");

  // --- Trạng thái (signal = useState / useRef) ---
  readonly forms = signal<any>(EMPTY_FORMS);

  /** Hàm set kiểu React cho signal "forms" (dùng khi truyền cho component con / callback) */
  protected readonly setFormsFn = reactSetter(this.forms);

  constructor() {
    // useEffect(..., [authModal, closeAuth])
    effect((onCleanup: any) => {
      this.authService.authModal();
      const cleanup = untracked(() => {
        if (!this.authService.authModal()) return undefined;
        const closeOnEscape = (event: any) => { if (event.key === "Escape") this.authService.closeAuth(); };
        document.addEventListener("keydown", closeOnEscape);
        document.body.style.overflow = "hidden";
        return () => {
          document.removeEventListener("keydown", closeOnEscape);
          document.body.style.overflow = "";
        };
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });
  }

  protected handle1(event: any) { if (event.target === event.currentTarget) this.authService.closeAuth(); }

  /** (tự sinh) function không dùng trực tiếp được trong template */
  protected compute2(): any {
    return (updater: any) => this.forms.update((current: any) => ({ ...current, login: updater(current.login) }));
  }

  /** (tự sinh) function không dùng trực tiếp được trong template */
  protected compute3(): any {
    return (updater: any) => this.forms.update((current: any) => ({ ...current, register: updater(current.register) }));
  }
}
