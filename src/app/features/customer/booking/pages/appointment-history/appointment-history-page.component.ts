import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';

import { DecisionModalService } from '../../../../../core/customer/services/decision-modal.service';
import { CustomerNavigationService } from '../../../../../core/customer/services/customer-navigation.service';
import { BookingApiService } from '../../../../../core/customer/services/api/booking-api.service';
import { SearchAndSortComponent } from './search-and-sort.component';
import { AppointmentCardComponent } from './appointment-card.component';
import { DetailPanelComponent } from './detail-panel.component';
import { ReviewModalComponent } from './review-modal.component';
import { RescheduleModalComponent } from './reschedule-modal.component';
import { appointmentImages } from '../../../../../shared/customer/assets/appointment-images';
import { APPOINTMENT_FILTERS, getAppointmentDisplayStatus } from '../../utils/appointment-display';
import { MOCK_APPOINTMENTS } from '../../data/mock-appointments';
import { getAppointmentDate, formatMoney } from './appointment-history-page.helpers';

/**
 * AppointmentHistoryPage — chuyển từ React: src/pages/Booking/AppointmentHistoryPage.jsx
 */
@Component({
  selector: 'div[app-appointment-history-page]',
  standalone: true,
  imports: [SearchAndSortComponent, AppointmentCardComponent, DetailPanelComponent, ReviewModalComponent, RescheduleModalComponent],
  templateUrl: './appointment-history-page.component.html',
  host: {
    'class': 'relative mx-auto flex w-full max-w-[939px] flex-col gap-8 pb-10',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppointmentHistoryPageComponent {
  // --- Service dùng chung ---
  protected readonly decisionModalService = inject(DecisionModalService);
  protected readonly navService = inject(CustomerNavigationService);
  protected readonly bookingApi = inject(BookingApiService);
  private readonly destroyRef = inject(DestroyRef);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly APPOINTMENT_FILTERS: any = APPOINTMENT_FILTERS;

  // --- Giá trị tính toán (computed) ---
  readonly counts = computed<any>(() => {
    return APPOINTMENT_FILTERS.reduce((acc: any, filter: any) => {
      (acc as any)[filter.value] =
        filter.value === "all"
          ? this.appointments().length
          : this.appointments().filter((item: any) => getAppointmentDisplayStatus(item).value === filter.value).length;
      return acc;
    }, {});
  });
  readonly filteredAppointments = computed<any>(() => {
    const normalizedSearch = this.searchQuery().trim().toLocaleLowerCase("vi");

    const result = this.appointments().filter((appointment: any) => {
      const status = getAppointmentDisplayStatus(appointment).value;
      const matchesFilter = this.activeFilter() === "all" || status === this.activeFilter();
      const matchesSearch =
        !normalizedSearch ||
        [
          appointment.code,
          appointment.pet.name,
          appointment.service.name,
          appointment.service.date,
          appointment.service.dateText,
          appointment.service.time,
          appointment.service.timeRange,
        ]
          .join(" ")
          .toLocaleLowerCase("vi")
          .includes(normalizedSearch);

      return matchesFilter && matchesSearch;
    });

    return [...result].sort((a: any, b: any) =>
      this.sortOrder() === "oldest"
        ? Number(getAppointmentDate(a)) - Number(getAppointmentDate(b))
        : Number(getAppointmentDate(b)) - Number(getAppointmentDate(a)),
    );
  });
  readonly selectedAppointment = computed<any>(() => this.appointments().find((item: any) => item.id === this.selectedId()));
  readonly reviewAppointment = computed<any>(() => this.appointments().find((item: any) => item.id === this.reviewAppointmentId()));
  readonly rescheduleAppointment = computed<any>(() => this.appointments().find((item: any) => item.id === this.rescheduleAppointmentId()));

  // --- Trạng thái (signal = useState / useRef) ---
  readonly appointments = signal<any>([]);
  readonly activeFilter = signal<any>("all");
  readonly searchInput = signal<any>("");
  readonly searchQuery = signal<any>("");
  readonly sortOrder = signal<any>("newest");
  readonly selectedId = signal<any>(null);
  readonly reviewAppointmentId = signal<any>(null);
  readonly rescheduleAppointmentId = signal<any>(null);
  readonly isLoading = signal<any>(true);
  readonly loadError = signal<any>("");
  readonly actionLoadingId = signal<any>(null);
  readonly actionMessage = signal<any>(null);

  constructor() {
    // useEffect(..., []) -> chạy 1 lần sau khi render
    afterNextRender(() => {
      const cleanup = (() => {
        let active = true;
        this.isLoading.set(true);
        this.loadError.set("");

        this.bookingApi.getAppointmentHistory()
          .then((items: any) => {
            if (active) {
              if (Array.isArray(items) && items.length > 0) {
                this.appointments.set(items);
              } else {
                this.appointments.set(MOCK_APPOINTMENTS);
              }
            }
          })
          .catch((error: any) => {
            if (!active) return;
            this.appointments.set(MOCK_APPOINTMENTS);
            this.loadError.set(error?.message || "Không thể tải lịch sử đặt lịch, đang hiển thị dữ liệu mẫu.");
          })
          .finally(() => {
            if (active) this.isLoading.set(false);
          });

        return () => {
          active = false;
        };
      })();
      if (typeof cleanup === 'function') this.destroyRef.onDestroy(cleanup);
    });
  }

  protected async handleAction(actionKey: any, appointment: any) {
    if (actionKey === "review" && appointment.canReview && !appointment.reviewed) {
      this.reviewAppointmentId.set(appointment.id);
      return;
    }

    if (actionKey === "cancel") {
      let confirmMsg = `Bạn chắc chắn muốn hủy lịch hẹn #${appointment.code}?\nHành động này không thể hoàn tác`;
      try {
        const cancelPreview = await this.bookingApi.getCancelPreview(appointment.id);
        if (cancelPreview?.policyMessage) {
          confirmMsg = `Xác nhận hủy lịch hẹn #${appointment.code}?\n${cancelPreview.policyMessage}\nHành động này không thể hoàn tác.`;
        } else if (appointment.freeChangeDaysLeft > 0) {
          confirmMsg = `Bạn chắc chắn muốn hủy lịch hẹn #${appointment.code}?\nLịch hẹn còn hơn 24 giờ nên bạn sẽ được hoàn 100% tiền cọc (nếu đã thanh toán cọc).\nHành động này không thể hoàn tác.`;
        }
      } catch {
        // Fallback to default message
      }

      this.decisionModalService.confirmCancel({
        message: confirmMsg,
        confirmLabel: "Hủy lịch",
        onConfirm: async () => {
          this.actionLoadingId.set(appointment.id);
          this.actionMessage.set(null);

          try {
            const cancelResult = await this.bookingApi.cancelAppointment(appointment.id, 'Khách hàng yêu cầu hủy lịch trên giao diện');
            const refundInfo = cancelResult?.cancel?.refundAmount || cancelResult?.refundAmount || 0;
            const refundOutcome = cancelResult?.cancel?.prepaidOutcome || cancelResult?.prepaidOutcome;
            const refundText = refundInfo > 0
              ? `\nSố tiền hoàn cọc dự kiến: ${formatMoney(refundInfo)} (${refundOutcome === 'REFUND_PENDING' ? 'Đang xử lý hoàn tiền' : 'Đã hoàn tiền'}).`
              : (appointment.depositAmount > 0 && appointment.freeChangeDaysLeft <= 0 ? '\nTiền cọc không được hoàn lại do hủy dưới 24 giờ.' : '');

            this.appointments.update((current: any) =>
              current.map((item: any) =>
                item.id === appointment.id
                  ? {
                      ...item,
                      status: "cancelled",
                      depositStatus: refundInfo > 0 ? 'REFUND_PENDING' : (item.depositAmount > 0 ? 'FORFEITED' : 'NOT_REQUIRED'),
                      depositStatusLabel: refundInfo > 0 ? 'Chờ hoàn cọc' : (item.depositAmount > 0 ? 'Không hoàn cọc' : 'Không yêu cầu'),
                      cancel: {
                        ...(item.cancel || {}),
                        reason: 'Khách hàng yêu cầu hủy lịch trên giao diện',
                        refundAmount: refundInfo,
                        prepaidOutcome: refundOutcome || (refundInfo > 0 ? 'REFUND_PENDING' : 'FORFEITED'),
                        prepaidOutcomeLabel: refundInfo > 0 ? 'Đang chờ hoàn tiền' : 'Không hoàn tiền cọc',
                      },
                      canCancel: false,
                      canReschedule: false,
                      canRebook: true,
                    }
                  : item,
              ));
            this.actionMessage.set({ type: "success", text: `Đã hủy lịch hẹn thành công.${refundText}` });
            this.decisionModalService.showSuccessModal({
              message: `Đã hủy lịch hẹn thành công.${refundText}\nBạn có thể tiếp tục hoặc quay về trang chủ.`,
            });
          } catch (error: any) {
            this.actionMessage.set({
              type: "error",
              text: error?.message || "Không thể hủy lịch hẹn lúc này. Vui lòng thử lại sau.",
            });
          } finally {
            this.actionLoadingId.set(null);
          }
        },
      });
      return;
    }

    if (actionKey === "pay") {
      this.decisionModalService.openDecisionModal({
        type: "cancel",
        title: "XÁC NHẬN",
        message: "Xác nhận thanh toán lịch hẹn tại phòng khám?\nHệ thống sẽ ghi nhận trạng thái chờ thanh toán tại quầy",
        confirmLabel: "Xác nhận",
        onConfirm: async () => {
          this.actionLoadingId.set(appointment.id);
          this.actionMessage.set(null);

          try {
            await this.bookingApi.checkoutAppointment(appointment.id, { paymentMethod: "store" });
            this.appointments.update((current: any) =>
              current.map((item: any) =>
                item.id === appointment.id
                  ? {
                      ...item,
                      status: "confirmed",
                      paymentMethod: "store",
                      paymentStatus: "waiting_store_payment",
                      canCancel: true,
                      canReschedule: true,
                    }
                  : item,
              ));
            this.actionMessage.set({
              type: "success",
              text: "Đã xác nhận lịch hẹn. Bạn có thể thanh toán tại phòng khám khi đến sử dụng dịch vụ.",
            });
            this.decisionModalService.showSuccessModal({
              message: "Đã xác nhận lịch hẹn thành công.\nBạn có thể tiếp tục hoặc quay về trang chủ",
            });
          } catch (error: any) {
            this.actionMessage.set({
              type: "error",
              text: error?.message || "Không thể xác nhận thanh toán lịch hẹn lúc này.",
            });
          } finally {
            this.actionLoadingId.set(null);
          }
        },
      });
      return;
    }

    if (actionKey === "reschedule") {
      this.rescheduleAppointmentId.set(appointment.id);
      return;
    }

    if (actionKey === "rebook") {
      const rebookServices = appointment.services?.length
        ? appointment.services
        : appointment.service?.id
          ? [{
              id: appointment.service.id,
              serviceId: appointment.service.id,
              name: appointment.service.name,
              serviceTypeId: appointment.service.serviceTypeId,
              quantity: 1,
            }]
          : [];
      this.navService.navigate("/dat-lich", {
        state: {
          rebookAppointment: {
            serviceTypeId: rebookServices[0]?.serviceTypeId,
            services: rebookServices,
            sourceAppointmentId: appointment.id,
          },
        },
      });
      return;
    }

    this.actionMessage.set({ type: "error", text: "Chức năng này chưa có API phù hợp để xử lý." });
  }

  protected async handleReviewSubmit({ targetId, rating, review }: any) {
    if (!targetId || !rating) {
      this.actionMessage.set({ type: "error", text: "Vui lòng chọn số sao trước khi gửi đánh giá." });
      return;
    }

    this.actionLoadingId.set(this.reviewAppointmentId());
    this.actionMessage.set(null);

    try {
      await this.bookingApi.createAppointmentServiceReview({
        serviceId: targetId,
        rating,
        comment: review,
      });
      this.appointments.update((current: any) =>
        current.map((appointment: any) =>
          appointment.id === this.reviewAppointmentId()
            ? { ...appointment, reviewed: true, canReview: false }
            : appointment,
        ));
      this.reviewAppointmentId.set(null);
      this.actionMessage.set({ type: "success", text: "Đã gửi đánh giá dịch vụ thành công." });
    } catch (error: any) {
      this.actionMessage.set({
        type: "error",
        text: error?.message || "Không thể gửi đánh giá lúc này.",
      });
    } finally {
      this.actionLoadingId.set(null);
    }
  }

  protected handleRescheduleSuccess(event: any) {
    this.rescheduleAppointmentId.set(null);
    const dateText = event.date;
    const timeText = event.slotValue;
    this.actionMessage.set({
      type: "success",
      text: `Đã đổi lịch hẹn sang ngày ${dateText} lúc ${timeText} thành công.`,
    });
    this.decisionModalService.showSuccessModal({
      message: `Đã đổi lịch hẹn sang ngày ${dateText} lúc ${timeText} thành công.\nCảm ơn bạn đã cập nhật thời gian đến phòng khám!`,
    });
    this.bookingApi.getAppointmentHistory().then((items: any) => {
      if (Array.isArray(items) && items.length > 0) {
        this.appointments.set(items);
      }
    });
  }

  protected handle1() {
    this.searchInput.set("");
    this.searchQuery.set("");
  }
}
