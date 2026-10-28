/**
 * Hằng số & hàm tiện ích dùng chung cho các component trong thư mục này.
 * (Chuyển từ phần code nằm ngoài component trong React: src/pages/Booking/AppointmentHistoryPage.jsx)
 */
import { appointmentImages } from '../../../../../shared/customer/assets/appointment-images';
import { APPOINTMENT_FILTERS, getAppointmentActions, getAppointmentDisplayStatus, getAppointmentTimelineSteps } from '../../utils/appointment-display';
import { formatVnd } from '../../../../../shared/customer/utils/currency';
import { MOCK_APPOINTMENTS } from '../../data/mock-appointments';

export const formatMoney = (value: any) => formatVnd(value);

export const paymentMethodLabels = {
  cash: "Thanh toán tại phòng khám",
  pay_at_clinic: "Thanh toán tại phòng khám",
  momo: "MoMo",
  zalopay: "ZaloPay",
  vnpay: "Thanh toán trực tuyến",
  bank: "Chuyển khoản ngân hàng",
  atm: "Thẻ ATM",
  card: "Thanh toán trực tuyến",
  online: "Thanh toán trực tuyến",
  store: "Thanh toán tại phòng khám",
};

export const getAppointmentDate = (appointment: any) => {
  if (appointment.rawDate) {
    const date = new Date(appointment.rawDate);
    if (!Number.isNaN(date.getTime())) return date;
  }
  const [day, month, year] = appointment.service.dateText.split("/").map(Number);
  const [hour, minute] = appointment.service.timeRange.split(" - ")[0].split(":").map(Number);
  return new Date(year, month - 1, day, hour, minute);
};

export const actionClasses = {
  yellow:
    "bg-[#fff176] text-black shadow-elevation hover:bg-[#fdd835]",
  primaryOutline:
    "border border-[#0d47a1] bg-white text-[#0d47a1] shadow-[0px_1px_3px_rgba(0,0,0,0.12),0px_1px_1px_rgba(0,0,0,0.14),0px_2px_1px_rgba(0,0,0,0.2)] hover:bg-[#e5f6fd]",
  dangerOutline:
    "border border-[#c62828] bg-white text-[#c62828] shadow-[0px_1px_3px_rgba(0,0,0,0.12),0px_1px_1px_rgba(0,0,0,0.14),0px_2px_1px_rgba(0,0,0,0.2)] hover:bg-[#ffdad6]",
};

// TODO(angular): custom React hook - đã chuyển thủ công sang component/service, xem bên dưới
// export function usePaymentCountdown(expiresAt) {
//   const getRemainingSeconds = () =>
//     expiresAt
//       ? Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))
//       : 0;
//   const [remainingSeconds, setRemainingSeconds] = useState(getRemainingSeconds);
// 
//   useEffect(() => {
//     if (!expiresAt) return undefined;
// 
//     const updateRemaining = () => setRemainingSeconds(getRemainingSeconds());
//     updateRemaining();
//     const intervalId = window.setInterval(updateRemaining, 1000);
//     return () => window.clearInterval(intervalId);
//   }, [expiresAt]);
// 
//   return remainingSeconds;
// }

