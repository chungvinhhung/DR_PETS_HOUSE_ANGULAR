import { ChangeDetectionStrategy, Component, ElementRef, computed, effect, inject, input, signal, untracked, viewChild } from '@angular/core';

import { CustomerNotificationService } from '../../../../core/customer/services/customer-notification.service';
import { NotificationPopupComponent } from './notification-popup.component';
import { navbarImages } from '../../../../shared/customer/assets/navbar-images';
import { mapNotificationToUI } from './notification-bell.helpers';

/**
 * NotificationBell — chuyển từ React: src/components/Notifications/NotificationBell.jsx
 */
@Component({
  selector: 'app-notification-bell',
  standalone: true,
  imports: [NotificationPopupComponent],
  templateUrl: './notification-bell.component.html',
  styleUrl: './notification-bell.component.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotificationBellComponent {
  // --- Service dùng chung ---
  protected readonly notificationService = inject(CustomerNotificationService);

  // --- Input / Output (props của React) ---
  readonly className = input<any>("hidden sm:inline-flex");
  readonly buttonClassName = input<any>("p-1");
  readonly iconClassName = input<any>("h-[36px] w-[32px]");
  readonly badgeClassName = input<any>("");

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly navbarImages: any = navbarImages;

  // --- Giá trị tính toán (computed) ---
  readonly filteredItems = computed<any>(() => (this.notificationService.notifications() || []).map(mapNotificationToUI));
  readonly readIds = computed<any>(() => this.filteredItems().filter((item: any) => !item.unread).map((item: any) => item.id));

  // --- Trạng thái (signal = useState / useRef) ---
  readonly isOpen = signal<any>(false);
  readonly activeFilter = signal<any>("all");
  readonly searchValue = signal<any>("");
  readonly rootRef = viewChild<ElementRef<any>>('rootRef');

  constructor() {
    // useEffect(..., [activeFilter, searchValue, fetchNotifications])
    effect((onCleanup: any) => {
      this.activeFilter();
      this.searchValue();
      const cleanup = untracked(() => {
        this.notificationService.fetchNotifications(this.activeFilter(), this.searchValue());
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });

    // useEffect(..., [closeAfterViewing, isOpen])
    effect((onCleanup: any) => {
      this.isOpen();
      const cleanup = untracked(() => {
        if (!this.isOpen()) return undefined;

        const handlePointerDown = (event: any) => {
          if (this.rootRef()?.nativeElement && !this.rootRef()?.nativeElement.contains(event.target)) {
            this.closeAfterViewing();
          }
        };

        const handleKeyDown = (event: any) => {
          if (event.key === "Escape") {
            this.closeAfterViewing();
          }
        };

        document.addEventListener("pointerdown", handlePointerDown);
        document.addEventListener("keydown", handleKeyDown);

        return () => {
          document.removeEventListener("pointerdown", handlePointerDown);
          document.removeEventListener("keydown", handleKeyDown);
        };
      });
      if (typeof cleanup === 'function') onCleanup(cleanup);
    });
  }

  protected closeAfterViewing() {
    this.isOpen.set(false);
  }

  protected handle1() {
    this.isOpen.update((current: any) => !current);
  }
}
