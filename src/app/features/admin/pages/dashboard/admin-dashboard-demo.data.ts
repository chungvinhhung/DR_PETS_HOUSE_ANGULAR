/**
 * TEMPORARY dashboard preview data. Only loaded with /admin/dashboard?demo=1.
 * All values are fabricated for UI review, NEVER send to API or persist.
 * To remove the preview, delete this file and the demo branches in the page.
 */
import type { DashboardSummary } from './admin-dashboard.service';

export interface DemoRevenuePoint {
  date: string;
  order: number;
  service: number;
}
export interface DemoActionRow {
  id: string;
  code: string;
  customerName: string;
  amount: number;
  time: string;
}
export interface DemoServiceRow { name: string; count: number }
export interface DemoStockRow {
  name: string;
  branch: string;
  quantity: number;
  threshold: number;
  /** Product photo for temporary UI preview only; not an inventory record image. */
  imageUrl: string;
}
export interface DemoDashboardData {
  summary: DashboardSummary;
  previous: { revenue: number; orders: number; appointments: number; customers: number };
  revenue: number;
  revenuePoints: DemoRevenuePoint[];
  appointmentStatuses: Record<string, number>;
  services: DemoServiceRow[];
  stocks: DemoStockRow[];
  orders: DemoActionRow[];
  appointments: DemoActionRow[];
}
export const DEMO_BRANCHES = [
  { id: 'demo-q1', code: 'Q1', name: 'Chi nhánh Quận 1', address: 'TP. Hồ Chí Minh', status: 'ACTIVE' as const },
  { id: 'demo-q3', code: 'Q3', name: 'Chi nhánh Quận 3', address: 'TP. Hồ Chí Minh', status: 'ACTIVE' as const },
  { id: 'demo-td', code: 'TD', name: 'Chi nhánh Thủ Đức', address: 'TP. Hồ Chí Minh', status: 'ACTIVE' as const },
];

function divide(total: number, weights: readonly number[]): number[] {
  if (!weights.length) return [];
  const sum = weights.reduce((a, b) => a + b, 0);
  const parts = weights.map(w => Math.floor(total * w / sum));
  parts[0] += total - parts.reduce((a, b) => a + b, 0);
  return parts;
}
function fixedCount(value: number, multiplier: number): number {
  return Math.max(0, Math.round(value * multiplier));
}
function offsetDate(ymd: string, days: number): string {
  const d = new Date(ymd + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function createDemoDashboard(from: string, to: string, branchId: string): DemoDashboardData {
  const start = Date.parse(from + 'T00:00:00Z');
  const end = Date.parse(to + 'T00:00:00Z');
  const duration = Number.isFinite(start) && Number.isFinite(end)
    ? Math.max(1, Math.round((end - start) / 86400000) + 1) : 30;
  const branchMultiplier = branchId ? 0.38 : 1;
  const multiplier = duration / 30 * branchMultiplier;
  const revenue = fixedCount(482560000, multiplier);
  const previousRevenue = fixedCount(427730000, multiplier);
  const orders = fixedCount(1246, multiplier);
  const appointments = fixedCount(368, multiplier);
  const customers = fixedCount(892, multiplier);
  const serviceRevenue = Math.round(revenue * 0.373);
  const orderRevenue = revenue - serviceRevenue;
  const pointsCount = Math.max(1, Math.min(duration, 60));
  const weights = Array.from({length: pointsCount}, (_, i) =>
    0.82 + 0.26 * Math.sin(i * 0.84) + 0.18 * Math.cos(i * 0.31) + i * 0.012);
  const orderParts = divide(orderRevenue, weights);
  const serviceParts = divide(serviceRevenue, weights.map((w, i) => w * (0.91 + 0.16 * Math.sin(i * 0.45))));
  const revenuePoints: DemoRevenuePoint[] = weights.map((_, i) => ({
    date: offsetDate(to, -(pointsCount - i - 1) * Math.max(1, Math.ceil(duration / pointsCount))),
    order: orderParts[i],
    service: serviceParts[i],
  }));
  const orderStatusValues = divide(orders, [943, 162, 86, 55]);
  const appointmentStatusValues = divide(appointments, [279, 47, 28, 14]);
  const branchName = branchId === 'demo-q3' ? 'Chi nhánh Quận 3'
    : branchId === 'demo-td' ? 'Chi nhánh Thủ Đức' : 'Chi nhánh Quận 1';
  const makeTime = (days: number, hour: number): string =>
    new Date(Date.now() + days * 86400000 + hour * 3600000).toISOString();
  return {
    summary: {
      orders, appointments,
      revenue: { amount: revenue, currency: 'VND' },
      newCustomers: customers, lowStockItems: 5,
      breakdown: {
        orderCountsByStatus: {
          COMPLETED: orderStatusValues[0], PROCESSING: orderStatusValues[1],
          PENDING: orderStatusValues[2], CANCELLED: orderStatusValues[3],
        },
        appointmentCountsByStatus: {
          COMPLETED: appointmentStatusValues[0], CONFIRMED: appointmentStatusValues[1],
          PENDING_PAYMENT: appointmentStatusValues[2], CANCELLED: appointmentStatusValues[3],
        },
      },
    },
    previous: {
      revenue: previousRevenue,
      orders: fixedCount(1143, multiplier),
      appointments: fixedCount(319, multiplier),
      customers: fixedCount(813, multiplier),
    },
    revenue, revenuePoints,
    appointmentStatuses: {
      COMPLETED: appointmentStatusValues[0], CONFIRMED: appointmentStatusValues[1],
      PENDING_PAYMENT: appointmentStatusValues[2], CANCELLED: appointmentStatusValues[3],
    },
    services: [
      { name: 'Khám sức khỏe thú cưng', count: fixedCount(162, multiplier) },
      { name: 'Tiêm phòng (vaccine)', count: fixedCount(124, multiplier) },
      { name: 'Grooming (tắm & làm đẹp)', count: fixedCount(113, multiplier) },
      { name: 'Triệt sản', count: fixedCount(42, multiplier) },
      { name: 'Điều trị ngoại trú', count: fixedCount(37, multiplier) },
    ],
    // Real retail product-package photos for the demo. Not Dr. Pet's House inventory photos.
    // Sources: bpets.cl, petshopdanang.com, harrodshealth.com, ananinja.com, windfinpet.com.
    // Replace with Product/Variant media from BE when real image URLs become available.
    stocks: [
      {
        name: 'Royal Canin Kitten (1,5 kg)', branch: branchName, quantity: 3, threshold: 10,
        imageUrl: 'https://www.bpets.cl/cdn/shop/files/Royal-Canin-Kitten-1.5kg.jpg?crop=center&height=900&v=1761861793&width=900',
      },
      {
        name: 'Sữa bột Dr.Kyan Predogen (400 g)', branch: branchName, quantity: 5, threshold: 15,
        imageUrl: 'https://cdn-images.kiotviet.vn/petshopdanang/12ab16a4c196427cbcccb49c98bf5d33.jpeg',
      },
      {
        name: 'Sữa tắm trị ve TresPaws (200 ml)', branch: branchName, quantity: 0, threshold: 12,
        imageUrl: 'https://www.harrodshealth.com/cdn/shop/products/ANTITICK-1_1.jpg?v=1708584213&width=600',
      },
      {
        name: 'Vòng cổ chống ve Bioline (60 cm)', branch: branchName, quantity: 8, threshold: 15,
        imageUrl: 'https://img.ananinja.com/media/ninja-catalog-42/sa_creations/supplier/6970117124484.png?q=90&w=480',
      },
      {
        name: 'Royal Canin Mini Adult (2 kg)', branch: branchName, quantity: 6, threshold: 12,
        imageUrl: 'https://bizweb.dktcdn.net/thumb/1024x1024/100/383/944/products/2.png?v=1587880959833',
      },
    ],
    orders: [
      { id: 'demo-order-1', code: 'ORD-20261109-0031', customerName: 'Lê Văn C', amount: 430000, time: makeTime(-1, 1) },
      { id: 'demo-order-2', code: 'ORD-20261109-0030', customerName: 'Trần Quốc Bảo', amount: 310000, time: makeTime(-1, 2) },
      { id: 'demo-order-3', code: 'ORD-20261108-0029', customerName: 'Đỗ Minh Trí', amount: 66000, time: makeTime(-2, 2) },
    ],
    appointments: [
      { id: 'demo-appointment-1', code: 'LH-20261110-008', customerName: 'Nguyễn Minh Anh', amount: 350000, time: makeTime(1, 1) },
      { id: 'demo-appointment-2', code: 'LH-20261110-009', customerName: 'Trần Quốc Bảo', amount: 220000, time: makeTime(1, 3) },
      { id: 'demo-appointment-3', code: 'LH-20261111-010', customerName: 'Lê Thị Mai', amount: 500000, time: makeTime(2, 4) },
    ],
  };
}
