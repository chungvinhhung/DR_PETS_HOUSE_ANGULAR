/** WBS 4.3 and Figma 6336:25285 / 6336:25795. Read-only adapters; contracts pending BE. */
export type ServiceRecordCategory = 'MEDICAL' | 'GROOMING' | 'UNKNOWN';
export type ServiceRecordStatus = 'IN_PROGRESS' | 'AWAITING_VET_REVIEW' | 'COMPLETED' | 'UNKNOWN';
export interface MaterialUsage {
  name: string;
  templateQuantity: string;
  actualQuantity: string;
  unit: string;
  note: string;
}
export interface ServiceRecord {
  id: string;
  code: string;
  appointmentId: string;
  appointmentCode: string;
  date: string | null;
  completedAt: string | null;
  petName: string;
  petDescription: string;
  serviceName: string;
  branchName: string;
  branchId: string;
  primaryStaff: string;
  primaryRole: string;
  category: ServiceRecordCategory;
  status: ServiceRecordStatus;
  rawStatus: string;
  note: string;
  nurseSegment: boolean | null;
  veterinarianReview: 'DONE' | 'PENDING' | 'UNKNOWN';
  reviewedBy: string;
  reviewedAt: string | null;
  allowedActions: string[] | null;
  materials: MaterialUsage[];
  history: {action: string; at: string | null; actor: string; note: string}[];
}
export interface ServiceRecordsPage { items: ServiceRecord[]; total: number; }
const record=(v:unknown):Record<string,unknown>|null => v!==null && typeof v==='object' && !Array.isArray(v)?v as Record<string,unknown>:null;
const str=(v:unknown):string => typeof v==='string'?v:'';
const first=(...a:unknown[]):string=>a.map(str).find(x=>x.trim())||'';
function unwrap(v:unknown):unknown{
  const r=record(v);if(!r)return v;
  if(r['EC']!==undefined&&r['EC']!==0)throw new Error(first(r['EM'],r['message'])||'Không tải được hồ sơ.');
  return r['DT']??r['data']??v;
}
function date(v:unknown):string|null{const s=str(v);return s && !Number.isNaN(Date.parse(s))?s:null;}
export function categoryOf(v:unknown):ServiceRecordCategory {
  const s=str(v).toUpperCase();return s==='MEDICAL'?'MEDICAL':s==='GROOMING'?'GROOMING':'UNKNOWN';
}
export function statusOf(v:unknown):ServiceRecordStatus {
  const s=str(v).toUpperCase();
  if(['COMPLETED','FINALIZED','FINALISED'].includes(s))return 'COMPLETED';
  if(['PENDING_VET_REVIEW','AWAITING_VET_REVIEW','WAITING_REVIEW'].includes(s))return 'AWAITING_VET_REVIEW';
  if(['IN_PROGRESS','PROCESSING','OPEN'].includes(s))return 'IN_PROGRESS';
  return 'UNKNOWN';
}
export function serviceRecordStatusLabel(s:ServiceRecordStatus, raw=''):string {
  return s==='COMPLETED'?'Hoàn thành':s==='AWAITING_VET_REVIEW'?'Chờ BS duyệt':
    s==='IN_PROGRESS'?'Đang thực hiện':raw||'Chưa xác định';
}
export function normalizeServiceRecord(raw:unknown):ServiceRecord {
  const r=record(raw);if(!r)throw new Error('Dữ liệu hồ sơ không hợp lệ.');
  const id=first(r['id'],r['_id'],r['serviceRecordId'],r['service_record_id']);
  if(!id)throw new Error('Hồ sơ không có ID từ BE.');
  const pet=record(r['pet'])||{};const branch=record(r['branch'])||{};
  const staff=record(r['primaryStaff'])||record(r['staff'])||{};
  const appointment=record(r['appointment'])||{};
  const service=record(r['service'])||{};
  const cat=categoryOf(r['recordType']??r['record_type']??r['category']??service['category']);
  const rawStatus=first(r['status'],r['recordStatus'],r['record_status']);
  const nurse=r['nurseSegment']??r['hasNurseSegment']??r['nurse_segment'];
  const review=record(r['veterinarianReview'])??record(r['vetReview']);
  const reviewStatus=first(review?.['status'],r['vetReviewStatus'],r['review_status']).toUpperCase();
  const reviewedAt=date(review?.['reviewedAt']??r['veterinarianReviewedAt']);
  const vet:'DONE'|'PENDING'|'UNKNOWN' =
    (reviewStatus==='APPROVED'||reviewStatus==='REVIEWED'||reviewStatus==='DONE')?'DONE':
    (reviewStatus==='PENDING'||reviewStatus==='REQUESTED')?'PENDING':'UNKNOWN';
  const rawMaterials=r['materials']??r['usedMaterials']??r['materialUsage'];
  const materials=Array.isArray(rawMaterials)?rawMaterials.map(v=>{
    const m=record(v)||{};const product=record(m['material'])||{};
    return {name:first(m['name'],m['materialName'],product['name']),
      templateQuantity:String(m['templateQuantity']??m['plannedQuantity']??''),
      actualQuantity:String(m['actualQuantity']??m['quantity']??''),
      unit:first(m['unit'],product['unit']),
      note:first(m['note'],m['remark'])};
  }):[];
  const rawHistory=r['statusHistory']??r['auditHistory']??r['history'];
  const history=Array.isArray(rawHistory)?rawHistory.map(v=>{const h=record(v)||{};return {
    action:first(h['action'],h['status'],h['type']),
    at:date(h['at']??h['createdAt']),
    actor:first(h['actorName'],h['actorId']),note:first(h['note'],h['reason'])};
  }).filter(h=>h.action):[];
  const actions=r['allowedActions'];
  return {
    id,code:first(r['code'],r['recordCode'],r['service_record_code'])||id,
    appointmentId:first(r['appointmentId'],r['appointment_id'],appointment['id']),
    appointmentCode:first(r['appointmentCode'],appointment['code']),
    date:date(r['date']??r['createdAt']??r['performedAt']),
    completedAt:date(r['completedAt']??r['finalizedAt']),
    petName:first(r['petName'],pet['name']),
    petDescription:first(r['petDescription'],pet['description']),
    serviceName:first(r['serviceName'],service['name']),
    branchName:first(r['branchName'],branch['name']),
    branchId:first(r['branchId'],branch['id'],branch['_id']),
    primaryStaff:first(r['primaryStaffName'],r['staffName'],staff['fullName'],staff['name']),
    primaryRole:first(r['primaryRole'],staff['role'],staff['jobRole']),
    category:cat,status:statusOf(rawStatus),rawStatus,
    note:first(r['resultNote'],r['result'],r['notes'],r['clinicalNotes']),
    nurseSegment:typeof nurse==='boolean'?nurse:null,
    veterinarianReview:vet,reviewedBy:first(review?.['reviewedBy'],review?.['reviewerName'],r['veterinarianName']),
    reviewedAt,
    allowedActions:Array.isArray(actions)?actions.filter((a):a is string=>typeof a==='string'):null,
    materials,history,
  };
}
export function normalizeServiceRecordsPage(raw:unknown):ServiceRecordsPage {
  const payload=unwrap(raw);const r=record(payload);
  const rows=Array.isArray(payload)?payload:Array.isArray(r?.['items'])?r['items']:
    Array.isArray(r?.['records'])?r['records']:null;
  if(!rows)throw new Error('API không trả về danh sách hồ sơ dịch vụ hợp lệ.');
  const page=record(r?.['pagination']);
  const total=r?.['total']??r?.['totalCount']??page?.['total'];
  return {items:rows.map(normalizeServiceRecord),total:typeof total==='number'&&total>=0?total:rows.length};
}
export function normalizeServiceRecordDetail(raw:unknown):ServiceRecord {
  const payload=unwrap(raw);const r=record(payload);return normalizeServiceRecord(r?.['record']??r?.['serviceRecord']??payload);
}
export type MedicalFinalizationCheck = {allowed:boolean;reason:string};
/** FE advisory: unverified review cannot count as completed; server must enforce. */
export function canFinalizeServiceRecord(r:ServiceRecord):MedicalFinalizationCheck {
  if(r.status==='COMPLETED')return {allowed:false,reason:'Hồ sơ đã hoàn thành.'};
  if(r.category==='UNKNOWN')return {allowed:false,reason:'BE chưa xác định loại hồ sơ.'};
  if(r.category==='MEDICAL'){
    if(r.nurseSegment===null)return {allowed:false,reason:'BE chưa xác nhận segment thực hiện có Y tá hay không.'};
    if(r.nurseSegment&&r.veterinarianReview!=='DONE')
      return {allowed:false,reason:'Hồ sơ MEDICAL có Y tá phải được Bác sĩ thú y review trước khi hoàn tất.'};
  }
  if(!r.allowedActions?.some(a=>/finaliz|complet/i.test(a)))
    return {allowed:false,reason:'BE chưa cấp quyền finalize hồ sơ.'};
  return {allowed:true,reason:'Điều kiện hiển thị sơ bộ phù hợp; BE phải kiểm tra lại khi lưu.'};
}
