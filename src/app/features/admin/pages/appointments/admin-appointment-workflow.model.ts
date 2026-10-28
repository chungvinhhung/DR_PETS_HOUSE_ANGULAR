export type AppointmentStatus =
  'PENDING' | 'PENDING_PAYMENT' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW' | 'UNKNOWN';

export interface AppointmentHistoryEvent {
  status: string;
  at: string | null;
  actor: string | null;
  note: string | null;
}
export interface AppointmentView {
  id: string;
  code: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  petNames: string[];
  serviceNames: string[];
  branchName: string;
  branchId: string;
  status: AppointmentStatus;
  rawStatus: string;
  paymentMethod: string;
  paymentStatus: string;
  totalAmount: number | null;
  depositAmount: number | null;
  balanceDue: number | null;
  createdAt: string | null;
  appointmentAt: string | null;
  rescheduleCount: number | null;
  allowedActions: string[] | null;
  history: AppointmentHistoryEvent[];
  cancellationReason: string | null;
  serviceRecordRefs: {id:string; code:string; type:string; status:string}[];
  refund: {id:string; status:string; requestedAmount:number|null; settledAmount:number|null;
    requestedAt:string|null; settledAt:string|null; note:string} | null;
  audit: {action:string; actor:string; at:string|null; reason:string; isOverride:boolean}[];
}
export interface AppointmentListPage {
  items: AppointmentView[];
  total: number;
  nextCursor: string | null;
}

const obj = (value: unknown): Record<string, unknown> | null =>
  value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
const valueText = (value: unknown): string => typeof value === 'string' ? value : '';
const firstString = (...values: unknown[]): string => values.find(v => typeof v === 'string' && v.trim()) as string || '';
const isDate = (s: string): boolean => Boolean(s) && Number.isFinite(new Date(s).getTime());
const toMoney = (v: unknown): number | null => typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null;

function unwrap(raw: unknown): unknown {
  const root = obj(raw);
  if (!root) return raw;
  if (root['EC'] !== undefined && root['EC'] !== 0) {
    throw new Error(firstString(root['EM'], root['message']) || 'Không tải được lịch hẹn.');
  }
  return root['DT'] ?? root['data'] ?? raw;
}

function namesFrom(value: unknown, singular: string): string[] {
  if (Array.isArray(value)) return value
    .map(v => {
      const o = obj(v);
      if (!o) return valueText(v);
      return firstString(o['name'], o['petName'], o['serviceName'],
        o['pet_name'], o['service_name'], obj(o[singular])?.['name']);
    }).filter(Boolean);
  const o = obj(value);
  return o ? [firstString(o['name'], o['petName'], o['serviceName'], o['pet_name'], o['service_name'])].filter(Boolean) : [];
}
export function appointmentStatus(raw: unknown): AppointmentStatus {
  const key = valueText(raw).toUpperCase();
  const statuses: Record<string, AppointmentStatus> = {
    PENDING:'PENDING', PENDING_PAYMENT:'PENDING_PAYMENT', REQUESTED:'PENDING', 
    CONFIRMED:'CONFIRMED', IN_PROGRESS:'IN_PROGRESS', PROCESSING:'IN_PROGRESS',
    COMPLETED:'COMPLETED', CANCELLED:'CANCELLED', CANCELED:'CANCELLED',
    NO_SHOW:'NO_SHOW', MISSED:'NO_SHOW',
  };
  return statuses[key] ?? 'UNKNOWN';
}
export function statusLabel(status: AppointmentStatus, rawStatus = ''): string {
  return ({
    PENDING:'Chờ xác nhận', PENDING_PAYMENT:'Chờ thanh toán', CONFIRMED:'Đã xác nhận', IN_PROGRESS:'Đang thực hiện',
    COMPLETED:'Hoàn tất', CANCELLED:'Đã hủy', NO_SHOW:'Không đến',
    UNKNOWN: rawStatus || 'Chưa xác định',
  } as Record<AppointmentStatus, string>)[status];
}
export function normalizeAppointment(raw: unknown): AppointmentView {
  const item = obj(raw);
  if (!item) throw new Error('Lịch hẹn không đúng cấu trúc dữ liệu.');
  const id = firstString(item['id'], item['_id'], item['appointmentId'], item['appointment_id']);
  if (!id) throw new Error('API không trả về ID lịch hẹn.');
  const customer = obj(item['customer']) ?? obj(item['user']) ?? {};
  const contact = obj(item['contactSnapshot']) ?? obj(item['guestContact']) ?? {};
  const branch = obj(item['branch']) ?? {};
  const payment = obj(item['payment']) ?? {};
  const rawStatus = firstString(item['status'], item['appointmentStatus']);
  const bookingDate = firstString(item['appointmentDate'], item['appointment_date']);
  const start = firstString(item['startAt'], item['start_at'], item['scheduledAt'], item['scheduled_at']);
  const hour = firstString(item['startTime'], item['start_time']);
  const combined = bookingDate && hour ? bookingDate.slice(0,10) + 'T' + hour : bookingDate;
  const date = isDate(start) ? start : isDate(combined) ? combined : null;
  const historyRows = item['statusHistory'] ?? item['history'] ?? item['auditHistory'];
  const reschedules = item['rescheduleCount'] ?? item['reschedule_count'];
  const refundRaw = obj(item['refund']) ?? obj(item['refundSummary']);
  const referenceRows = item['serviceRecords'] ?? item['serviceRecordRefs'];
  const auditRows = item['auditHistory'] ?? item['auditLog'];
  return {
    id, code:firstString(item['code'], item['appointmentCode'], item['appointment_code']) || id,
    customerName:firstString(item['customerName'], item['customer_name_snapshot'], customer['fullName'], customer['full_name'], contact['fullName']),
    customerPhone:firstString(item['customerPhone'], item['customer_phone_snapshot'], customer['phone'], contact['phone']),
    customerEmail:firstString(item['customerEmail'], customer['email'], contact['email']),
    petNames:namesFrom(item['pets'] ?? item['pet'], 'pet').length
      ? namesFrom(item['pets'] ?? item['pet'], 'pet') : firstString(item['petName'], item['pet_name_snapshot']) ? [firstString(item['petName'], item['pet_name_snapshot'])] : [],
    serviceNames:namesFrom(item['services'] ?? item['appointment_services'], 'service').length
      ? namesFrom(item['services'] ?? item['appointment_services'], 'service') : firstString(item['serviceName']) ? [firstString(item['serviceName'])] : [],
    branchName:firstString(item['branchName'], branch['name'], branch['branch_name']),
    branchId:firstString(item['branchId'], item['branch_id'], branch['id'], branch['_id']),
    status:appointmentStatus(rawStatus),rawStatus,
    paymentMethod:firstString(item['paymentMethod'], item['payment_method'], payment['method']),
    paymentStatus:firstString(item['paymentStatus'], item['payment_status'], payment['status']),
    totalAmount:toMoney(obj(item['pricing'])?.['totalAmount'] ?? item['totalAmount'] ?? item['total_amount']),
    depositAmount:toMoney(obj(item['pricing'])?.['depositAmount'] ?? item['depositAmount'] ?? item['deposit_amount']),
    balanceDue:toMoney(obj(item['pricing'])?.['balanceDue'] ?? item['balanceDue'] ?? item['balance_due']),
    createdAt:isDate(firstString(item['createdAt'],item['created_at'])) ? firstString(item['createdAt'],item['created_at']) : null,
    appointmentAt:date,
    rescheduleCount:typeof reschedules === 'number' && Number.isInteger(reschedules) && reschedules >= 0 ? reschedules : null,
    allowedActions:Array.isArray(item['allowedActions']) ? item['allowedActions'].filter((a): a is string => typeof a === 'string') : null,
    history:Array.isArray(historyRows) ? historyRows.map(row => {
      const event = obj(row) ?? {};
      return {status:firstString(event['status'], event['action']), at:firstString(event['at'],event['createdAt']) || null,
        actor:firstString(event['actorName'], event['actorId']) || null,
        note:firstString(event['note'],event['reason']) || null};
    }).filter(row=>!!row.status) : [],
    cancellationReason:firstString(item['cancellationReason'], item['cancelReason']) || null,
    serviceRecordRefs:Array.isArray(referenceRows) ? referenceRows.map(raw=>{
      const r=obj(raw);if(!r)return null;
      const id=firstString(r['id'],r['serviceRecordId'],r['_id']);
      return id?{id,code:firstString(r['code'],r['recordCode'])||id,
        type:firstString(r['recordType'],r['type']),status:firstString(r['status'])}:null;
    }).filter((v):v is {id:string;code:string;type:string;status:string}=>v!==null):[],
    refund:refundRaw ? {
      id:firstString(refundRaw['id'],refundRaw['refundId']),
      status:firstString(refundRaw['status']),
      requestedAmount:toMoney(refundRaw['requestedAmount']??refundRaw['amount']),
      settledAmount:toMoney(refundRaw['settledAmount']??refundRaw['refundedAmount']),
      requestedAt:isDate(firstString(refundRaw['requestedAt'],refundRaw['createdAt']))?
        firstString(refundRaw['requestedAt'],refundRaw['createdAt']):null,
      settledAt:isDate(firstString(refundRaw['settledAt'],refundRaw['refundedAt']))?
        firstString(refundRaw['settledAt'],refundRaw['refundedAt']):null,
      note:firstString(refundRaw['note'],refundRaw['reason']),
    }:null,
    audit:Array.isArray(auditRows) ? auditRows.map(raw=>{
      const row=obj(raw)??{};
      return {action:firstString(row['action'],row['type']),
        actor:firstString(row['actorName'],row['actorId']),
        at:isDate(firstString(row['at'],row['createdAt']))?firstString(row['at'],row['createdAt']):null,
        reason:firstString(row['reason'],row['note']),
        isOverride:row['isOverride']===true || row['override']===true};
    }).filter(row=>row.action):[],
  };
}
export function normalizeAppointmentPage(raw: unknown): AppointmentListPage {
  const payload = unwrap(raw);
  const page = obj(payload);
  const list = Array.isArray(payload) ? payload :
    Array.isArray(page?.['items']) ? page['items'] :
    Array.isArray(page?.['appointments']) ? page['appointments'] : null;
  if (!list) throw new Error('API không trả về danh sách lịch hẹn hợp lệ.');
  const items = list.map(normalizeAppointment);
  const pagination = obj(page?.['pagination']);
  const total = page?.['total'] ?? page?.['totalCount'] ?? page?.['totalItems'] ?? pagination?.['total'];
  return {items, total:typeof total === 'number' && total >= 0 ? total : items.length,
    nextCursor:firstString(page?.['nextCursor'],pagination?.['nextCursor']) || null};
}
export function normalizeAppointmentDetail(raw: unknown): AppointmentView {
  const payload = unwrap(raw);
  const root = obj(payload);
  return normalizeAppointment(root?.['appointment'] ?? payload);
}

export type WindowEligibility = 'eligible' | 'too-late' | 'missing-time' | 'missing-count' | 'limit-reached' | 'terminal';
export interface AppointmentWindowDecision {
  status: WindowEligibility;
  hoursRemaining: number | null;
  canRequest: boolean;
  overrideRequiresAudit: boolean;
}
/** Display guidance only. BE must enforce its own clock, role, exceptions, and policy. */
export function appointmentWindow(
  appointment: AppointmentView, action: 'cancel' | 'reschedule', nowMs: number,
  isManagerOrAdmin: boolean,
): AppointmentWindowDecision {
  if (['CANCELLED','COMPLETED','NO_SHOW','IN_PROGRESS','UNKNOWN','PENDING_PAYMENT'].includes(appointment.status))
    return {status:'terminal',hoursRemaining:null,canRequest:false,overrideRequiresAudit:false};
  if (action === 'reschedule' && appointment.rescheduleCount === null)
    return {status:'missing-count',hoursRemaining:null,canRequest:false,overrideRequiresAudit:false};
  if (action === 'reschedule' && appointment.rescheduleCount !== null && appointment.rescheduleCount >= 2)
    return {status:'limit-reached',hoursRemaining:null,canRequest:isManagerOrAdmin,overrideRequiresAudit:isManagerOrAdmin};
  if (!appointment.appointmentAt)
    return {status:'missing-time',hoursRemaining:null,canRequest:false,overrideRequiresAudit:false};
  const hours = (new Date(appointment.appointmentAt).getTime() - nowMs) / 3600000;
  if (!Number.isFinite(hours)) return {status:'missing-time',hoursRemaining:null,canRequest:false,overrideRequiresAudit:false};
  const late = hours < 24;
  return {status:late?'too-late':'eligible',hoursRemaining:hours,
    canRequest:!late || isManagerOrAdmin,overrideRequiresAudit:late && isManagerOrAdmin};
}
