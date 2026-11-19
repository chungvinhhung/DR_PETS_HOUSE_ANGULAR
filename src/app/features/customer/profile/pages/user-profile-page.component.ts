import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';

import { CustomerAuthService } from '../../../../core/customer/services/customer-auth.service';
import { UserApiService } from '../../../../core/customer/services/api/user-api.service';
import { AddressFormModalComponent } from '../../../../shared/customer/components/address-form-modal/address-form-modal.component';
import { ChangePasswordModalComponent } from './change-password-modal.component';
import { CustomerButtonComponent } from '../../../../shared/customer/components/customer-button/customer-button.component';
import { UserProfileFieldComponent } from './user-profile-field.component';
import { AddressCardComponent } from './address-card.component';
import { CustomerIconComponent } from '../../../../shared/customer/components/icon/customer-icon.component';
import { SelectValueDirective } from '../../../../shared/customer/directives/select-value.directive';
import { DEFAULT_USER_ADDRESSES, DEFAULT_USER_PROFILE, PROFILE_STORAGE_KEYS } from '../../../../core/customer/constants/user-profile-data';
import { inputClass, loadStoredData } from './user-profile-page.helpers';

const defaultAvatar = '/assets/customer/images/profile/user-avatar.png';

/**
 * UserProfilePage — chuyển từ React: src/pages/User/UserProfilePage.jsx
 */
@Component({
  selector: 'div[app-user-profile-page]',
  standalone: true,
  imports: [AddressFormModalComponent, ChangePasswordModalComponent, CustomerButtonComponent, UserProfileFieldComponent, AddressCardComponent, CustomerIconComponent, SelectValueDirective],
  templateUrl: './user-profile-page.component.html',
  styleUrl: './user-profile-page.component.scss',
  host: {
    'class': 'mx-auto w-full max-w-page font-sans text-[rgba(0,0,0,0.87)]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserProfilePageComponent {
  // --- Service dùng chung ---
  protected readonly authService = inject(CustomerAuthService);
  protected readonly userApi = inject(UserApiService);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly inputClass: any = inputClass;

  // --- Giá trị tính toán (computed) ---
  readonly userId = computed<any>(() => this.profile().userId || this.authService.userProfile()?.userId);

  // --- Trạng thái (signal = useState / useRef) ---
  readonly profile = signal<any>((() =>
    loadStoredData(PROFILE_STORAGE_KEYS.profile, DEFAULT_USER_PROFILE))());
  readonly addresses = signal<any>((() =>
    loadStoredData(PROFILE_STORAGE_KEYS.addresses, DEFAULT_USER_ADDRESSES))());
  readonly avatar = signal<any>(defaultAvatar);
  readonly message = signal<any>("");
  readonly addressModal = signal<any>(null);
  readonly isLoadingProfile = signal<any>(false);
  readonly isSavingProfile = signal<any>(false);
  readonly showChangePassword = signal<any>(false);
  readonly fileInputRef = viewChild<ElementRef<any>>('fileInputRef');

  constructor() {
    // useEffect(..., [message])
    effect((onCleanup: any) => {
      this.message();
      const cleanup = untracked(() => {
        if (!this.message()) return undefined;
        const timeoutId = window.setTimeout(() => this.message.set(""), 2500);
        return () => window.clearTimeout(timeoutId);
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });

    // useEffect(..., [userId])
    effect((onCleanup: any) => {
      this.userId();
      const cleanup = untracked(() => {
        if (!this.userId()) return undefined;

        let active = true;
        this.isLoadingProfile.set(true);

        Promise.allSettled([this.userApi.getUserProfile(this.userId()), this.userApi.getUserAddresses(this.userId())])
          .then(([profileResult, addressesResult]: any) => {
            if (!active) return;

            if (profileResult.status === "fulfilled") {
              const nextProfile = {
                ...this.profile(),
                ...profileResult.value,
                fullName: profileResult.value.fullName || this.profile().fullName,
                email: profileResult.value.email || this.profile().email,
                phone: profileResult.value.phone || this.profile().phone,
              };
              this.profile.set(nextProfile);
              this.authService.updateUserProfile(nextProfile);
            }

            if (addressesResult.status === "fulfilled") {
              this.addresses.set(addressesResult.value);
              localStorage.setItem(PROFILE_STORAGE_KEYS.addresses, JSON.stringify(addressesResult.value));
            }

            if (profileResult.status === "rejected" && addressesResult.status === "rejected") {
              this.message.set("Không thể tải hồ sơ mới nhất, đang dùng dữ liệu dự phòng.");
            }
          })
          .finally(() => {
            if (active) this.isLoadingProfile.set(false);
          });

        return () => {
          active = false;
        };
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });
  }

  protected updateProfile(event: any) {
    const { name, value } = event.target;
    this.profile.update((current: any) => ({ ...current, [name]: value }));
  }

  protected async saveProfile(event: any) {
    event.preventDefault();
    this.isSavingProfile.set(true);

    try {
      const savedProfile = this.userId()
        ? await this.userApi.updateUserProfileApi(this.userId(), this.profile())
        : this.profile();
      const nextProfile = { ...this.profile(), ...savedProfile };
      this.profile.set(nextProfile);
      this.authService.updateUserProfile(nextProfile);
      this.message.set(this.userId() ? "Đã lưu thông tin người dùng." : "Đã lưu thông tin tạm thời.");
    } catch (error: any) {
      this.authService.updateUserProfile(this.profile());
      this.message.set(error?.message || "Không thể lưu lên API, đã giữ dữ liệu tạm thời.");
    } finally {
      this.isSavingProfile.set(false);
    }
  }

  protected changeAvatar(event: any) {
    const file = event.target.files?.[0];
    if (!file) return;
    this.avatar.set(URL.createObjectURL(file));
  }

  protected saveAddresses(nextAddresses: any) {
    this.addresses.set(nextAddresses);
    localStorage.setItem(PROFILE_STORAGE_KEYS.addresses, JSON.stringify(nextAddresses));
  }

  protected async saveAddress(address: any) {
    const fallbackAddress = {
      ...address,
      id: address.id || `address-${Date.now()}`,
      isDefault: address.isDefault ?? this.addresses().length === 0,
    };
    let successMessage = address.id ? "Đã cập nhật địa chỉ." : "Đã thêm địa chỉ mới.";

    try {
      if (address.id && !String(address.id).startsWith("address-")) {
        const savedAddress = await this.userApi.updateUserAddress(address.id, address);
        this.saveAddresses(this.addresses().map((item: any) => (item.id === address.id ? savedAddress : item)));
      } else if (address.id) {
        this.saveAddresses(this.addresses().map((item: any) => (item.id === address.id ? fallbackAddress : item)));
      } else if (this.userId()) {
        const savedAddress = await this.userApi.createUserAddress(this.userId(), fallbackAddress);
        this.saveAddresses([...this.addresses(), savedAddress]);
      } else {
        this.saveAddresses([...this.addresses(), fallbackAddress]);
      }
    } catch (error: any) {
      if (address.id) {
        this.saveAddresses(this.addresses().map((item: any) => (item.id === address.id ? fallbackAddress : item)));
      } else {
        this.saveAddresses([...this.addresses(), fallbackAddress]);
      }
      successMessage = error?.message || "API địa chỉ lỗi, đã lưu dữ liệu tạm thời.";
    }

    this.addressModal.set(null);
    this.message.set(successMessage);
  }

  protected async deleteAddress(id: any) {
    try {
      if (!String(id).startsWith("address-")) await this.userApi.deleteUserAddress(id);
    } catch (error: any) {
      this.message.set(error?.message || "Không thể xóa địa chỉ trên API, đã xóa tạm trên giao diện.");
    }
    this.saveAddresses(this.addresses().filter((address: any) => address.id !== id));
  }

  protected async setDefaultAddress(id: any) {
    const targetAddress = this.addresses().find((address: any) => address.id === id);
    if (!targetAddress) return;

    try {
      if (!String(id).startsWith("address-")) {
        await this.userApi.updateUserAddress(id, { ...targetAddress, isDefault: true });
      }
    } catch (error: any) {
      this.message.set(error?.message || "Không thể đặt mặc định trên API, đã cập nhật tạm.");
    }

    this.saveAddresses(this.addresses().map((address: any) => ({ ...address, isDefault: address.id === id })));
  }

  protected handle1() {
    this.showChangePassword.set(false);
    this.message.set("Đổi mật khẩu thành công. Vui lòng đăng nhập lại.");
    window.setTimeout(() => this.authService.logout(), 600);
  }
}
