import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';

import { ContactApiService } from '../../../../core/customer/services/api/contact-api.service';
import { SelectValueDirective } from '../../../../shared/customer/directives/select-value.directive';
import { ReactStyleDirective } from '../../../../shared/customer/directives/react-style.directive';
import { contactAssets } from '../data/contact-data';
import { INITIAL_FORM } from './contact-page.helpers';

/**
 * ContactForm — chuyển từ React: src/pages/Contact/ContactPage.jsx
 */
@Component({
  selector: 'form[app-contact-form]',
  standalone: true,
  imports: [SelectValueDirective, ReactStyleDirective],
  templateUrl: './contact-form.component.html',
  host: {
    'class': 'contact-form',
    '(submit)': 'submitForm($any($event))',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ContactFormComponent {
  // --- Service dùng chung ---
  protected readonly contactApi = inject(ContactApiService);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly contactAssets: any = contactAssets;

  // --- Trạng thái (signal = useState / useRef) ---
  readonly form = signal<any>(INITIAL_FORM);
  readonly submitted = signal<any>(false);
  readonly loading = signal<any>(false);
  readonly error = signal<any>(null);

  protected updateField(field: any) {
    return (event: any) => {
    this.submitted.set(false);
    this.error.set(null);
    this.form.update((current: any) => ({ ...current, [field]: event.target.value }));
  };
  }

  protected async submitForm(event: any) {
    event.preventDefault();
    this.loading.set(true);
    this.error.set(null);
    try {
      await this.contactApi.submitContactMessage(this.form());
      this.submitted.set(true);
      this.form.set(INITIAL_FORM);
    } catch (err: any) {
      this.error.set("Đã xảy ra lỗi khi gửi. Vui lòng thử lại sau.");
    } finally {
      this.loading.set(false);
    }
  }
}
