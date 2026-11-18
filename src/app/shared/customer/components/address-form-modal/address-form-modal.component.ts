import { ChangeDetectionStrategy, Component, computed, effect, input, output, signal, untracked, OnInit, inject } from '@angular/core';

import { AddressFormFieldComponent } from './address-form-field.component';
import { CustomerIconComponent } from '../icon/customer-icon.component';
import { EMPTY_ADDRESS, VIETNAM_PROVINCES } from './address-form-modal.helpers';
import { LocationApiService } from '../../../../core/customer/services/api/location-api.service';

/**
 * AddressFormModal — chuyển từ React: src/components/address/AddressFormModal.jsx
 */
@Component({
  selector: 'div[app-address-form-modal]',
  standalone: true,
  imports: [AddressFormFieldComponent, CustomerIconComponent],
  templateUrl: './address-form-modal.component.html',
  styleUrl: './address-form-modal.component.scss',
  host: {
    'class': 'fixed inset-0 z-[100] flex items-center justify-center bg-[rgba(6,16,90,0.2)] p-4 backdrop-blur-[2px]',
    '(mousedown)': 'handle1($any($event))',
    'role': 'presentation',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AddressFormModalComponent implements OnInit {
  private readonly locationApi = inject(LocationApiService);
  protected readonly vietnamProvinces = signal<string[]>(VIETNAM_PROVINCES);
  protected readonly wardOptions = signal<string[]>([]);
  // --- Input / Output (props của React) ---
  readonly address = input<any>(undefined);
  readonly defaultValues = input<any>(undefined);
  readonly mode = input<any>("add");
  readonly onClose = output<any>();
  readonly onSave = output<any>();

  // --- Giá trị tính toán (computed) ---
  readonly title = computed<any>(() => this.mode() === "edit" ? "Thay đổi địa chỉ" : "Thêm địa chỉ mới");

  // --- Trạng thái (signal = useState / useRef) ---
  readonly form = signal<any>(undefined);
  readonly validationAttempted = signal<any>(false);

  constructor() {
    // useEffect(..., [onClose])
    effect((onCleanup: any) => {
      const cleanup = untracked(() => {
        const handleKeyDown = (event: any) => {
          if (event.key === "Escape") this.onClose.emit(undefined);
        };
        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });
  }

  ngOnInit(): void {
    const initialForm = {
      ...EMPTY_ADDRESS,
      ...this.defaultValues(),
      ...this.address(),
      name: this.address()?.name ?? this.address()?.recipient ?? this.defaultValues()?.name ?? "",
    };
    this.form.set(initialForm);

    // Fetch dynamic provinces from Location API
    this.locationApi.getProvinces().then((provinces) => {
      if (provinces && provinces.length > 0) {
        this.vietnamProvinces.set(provinces.map((p) => p.name));
      }
    });

    // If city is already present, fetch wards
    if (initialForm.city) {
      this.loadWardsForCity(initialForm.city);
    }
  }

  private async loadWardsForCity(city: string) {
    if (!city || !city.trim()) {
      this.wardOptions.set([]);
      return;
    }
    const wards = await this.locationApi.getWards('', city);
    if (wards && wards.length > 0) {
      this.wardOptions.set(wards.map((w) => w.name));
    }
  }

  protected updateField(field: any, value: any) {
    this.form.update((current: any) => ({ ...current, [field]: value }));
    if (field === 'city') {
      this.loadWardsForCity(value);
    }
  }

  protected handleSubmit(event: any) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const requiredFields = ["name", "phone", "country", "address", "city"];
    if (requiredFields.some((field: any) => !String((this.form() as any)[field] ?? "").trim())) {
      this.validationAttempted.set(true);
      window.setTimeout(() => {
        (formElement.querySelector('[data-address-error="true"]') as any)?.focus();
      }, 0);
      return;
    }
    this.onSave.emit({ ...this.address(), ...this.form(), recipient: this.form().name });
  }

  protected handle1(event: any) {
    if (event.target === event.currentTarget) this.onClose.emit(undefined);
  }
}
