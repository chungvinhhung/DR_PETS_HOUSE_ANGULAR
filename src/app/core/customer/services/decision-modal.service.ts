import { Injectable, signal } from '@angular/core';

/** notice: icon cảnh báo như delete/cancel nhưng nút vàng như success (thông báo, không phải thao tác nguy hiểm). */
export type DecisionModalType = 'delete' | 'cancel' | 'success' | 'notice';

export interface DecisionModalOptions {
  type?: DecisionModalType;
  title?: string;
  message?: string;
  /** Phần in đậm nối ngay sau message, vd. message "Bạn chắc chắn muốn " + messageBold "Ẩn hồ sơ của Ted" + messageSuffix "?" */
  messageBold?: string;
  image?: string;
  messageSuffix?: string;
  cancelLabel?: string;
  confirmLabel?: string;
  onConfirm?: (() => void) | null;
  onCancel?: (() => void) | null;
}

export interface DecisionModalState extends Required<Omit<DecisionModalOptions, 'onConfirm' | 'onCancel'>> {
  open: boolean;
  variant?: string;
  image: string;
  onConfirm: (() => void) | null;
  onCancel: (() => void) | null;
}

const DEFAULT_COPY: Record<DecisionModalType, Partial<DecisionModalState>> = {
  delete: {
    title: 'XÁC NHẬN XÓA',
    message: 'Bạn chắc chắn muốn xóa?\nHành động này không thể hoàn tác',
    confirmLabel: 'Xóa',
    variant: 'danger',
  },
  cancel: {
    title: 'XÁC NHẬN HỦY',
    message: 'Bạn chắc chắn muốn hủy?\nHành động này không thể hoàn tác',
    confirmLabel: 'Hủy',
    variant: 'danger',
  },
  success: {
    title: 'THÀNH CÔNG',
    message: 'Đã xóa dữ liệu thành công.\nBạn có thể tiếp tục hoặc quay về trang chủ',
    cancelLabel: 'Quay về Trang chủ',
    confirmLabel: 'Tiếp tục',
    variant: 'success',
  },
  notice: {
    title: 'THÔNG BÁO',
    message: '',
    cancelLabel: 'Quay về Trang chủ',
    confirmLabel: 'Đóng',
    variant: 'notice',
  },
};

const INITIAL_STATE: DecisionModalState = {
  open: false,
  type: 'delete',
  title: '',
  message: '',
  messageBold: '',
  messageSuffix: '',
  image: '',
  cancelLabel: '',
  confirmLabel: '',
  onConfirm: null,
  onCancel: null,
};

/**
 * Popup xác nhận dùng chung (thay cho DecisionModalProvider + useDecisionModal của React).
 *
 *   decisionModalService.confirmDelete({ onConfirm: () => xoa() });
 *   decisionModalService.confirmCancel({ message: '...', onConfirm: () => huy() });
 *   decisionModalService.showSuccessModal({ title: 'THÀNH CÔNG', message: '...' });
 *
 * Giao diện popup: shared/customer/components/decision-modal (đặt sẵn trong CustomerLayout).
 */
@Injectable({ providedIn: 'root' })
export class DecisionModalService {
  readonly state = signal<DecisionModalState>(INITIAL_STATE);

  readonly openDecisionModal = (options: DecisionModalOptions = {}): void => {
    const defaults = DEFAULT_COPY[options.type || 'delete'] || DEFAULT_COPY.delete;
    this.state.set({
      ...INITIAL_STATE,
      ...defaults,
      ...(options as Partial<DecisionModalState>),
      open: true,
      message: options.message || defaults.message || '',
    });
  }

  readonly confirmDelete = (options: DecisionModalOptions = {}): void => {
    this.openDecisionModal({ type: 'delete', ...options });
  }

  readonly confirmCancel = (options: DecisionModalOptions = {}): void => {
    this.openDecisionModal({ type: 'cancel', ...options });
  }

  readonly showSuccessModal = (options: DecisionModalOptions = {}): void => {
    this.openDecisionModal({ type: 'success', ...options });
  }

  readonly showNotice = (options: DecisionModalOptions = {}): void => {
    this.openDecisionModal({ type: 'notice', ...options });
  }

  readonly close = (): void => {
    this.state.set(INITIAL_STATE);
  }

  readonly cancel = (): void => {
    const current = this.state();
    this.state.set(INITIAL_STATE);
    if (current.type === 'success' && !current.onCancel) window.location.href = '/';
    else current.onCancel?.();
  }

  readonly confirm = (): void => {
    const current = this.state();
    this.state.set(INITIAL_STATE);
    current.onConfirm?.();
  }
}
