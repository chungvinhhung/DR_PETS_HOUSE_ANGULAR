/** WBS 4.3 ServiceRecord adapter for the live execution API contract. */
export type ServiceRecordCategory = 'MEDICAL' | 'GROOMING' | 'UNKNOWN';
export type ServiceRecordStatus = 'DRAFT' | 'IN_PROGRESS' | 'WAITING_VET_REVIEW' | 'COMPLETED' | 'REOPENED' | 'UNKNOWN';
export interface MaterialUsage {
  inventoryItemId: string;
  name: string;
  templateQuantity: string;
  actualQuantity: string;
  unit: string;
  note: string;
  stockAfter: number | null;
  inventoryTransactionCode: string;
}
export interface ServiceRecord {
  id: string;
  code: string;
  appointmentId: string;
  appointmentCode: string;
  petId: string;
  serviceIds: string[];
  assignedStaffIds: string[];
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
  recordVersion: number | null;
  version: number | null;
  reviewerStaffId: string;
  professional: {diagnosis:string;treatment:string;result:string;professionalNote:string} | null;
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
  if(['PENDING_VET_REVIEW','AWAITING_VET_REVIEW','WAITING_VET_REVIEW','WAITING_REVIEW'].includes(s))return 'WAITING_VET_REVIEW';
  if(['IN_PROGRESS','PROCESSING','OPEN'].includes(s))return 'IN_PROGRESS';
  if(s==='REOPENED')return 'REOPENED';
  if(s==='DRAFT')return 'DRAFT';
  return 'UNKNOWN';
}
export function serviceRecordStatusLabel(s:ServiceRecordStatus, raw=''):string {
  return s==='COMPLETED'?'Hoàn thành':s==='WAITING_VET_REVIEW'?'Chờ BS duyệt':
    s==='IN_PROGRESS'?'Đang thực hiện':s==='REOPENED'?'Đã mở lại':s==='DRAFT'?'Bản nháp':raw||'Chưa xác định';
}
export function normalizeServiceRecord(raw:unknown):ServiceRecord {
  const r=record(raw);if(!r)throw new Error('Dữ liệu hồ sơ không hợp lệ.');
  const id=first(r['id'],r['_id'],r['serviceRecordId'],r['service_record_id']);
  if(!id)throw new Error('Dữ liệu hồ sơ chưa đầy đủ.');
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
  const rawMaterials=r['actualMaterials']??r['materials']??r['usedMaterials']??r['materialUsage'];
  const planned=Array.isArray(r['plannedMaterials']) ? r['plannedMaterials'] : [];
  const plannedById=new Map(planned.map(v=>{const x=record(v)||{};return [first(x['inventoryItemId'],x['materialId']),x];}));
  const prof=record(r['professional']);
  const actualRows=Array.isArray(rawMaterials)?rawMaterials:[];
  const actualIds=new Set(actualRows.map(v=>{
    const m=record(v)||{};
    return first(m['inventoryItemId'],m['materialId']);
  }));
  const materialRows=[
    ...actualRows.map(v=>({item:v,isActual:true})),
    ...planned.filter(v=>{
      const m=record(v)||{};
      return !actualIds.has(first(m['inventoryItemId'],m['materialId']));
    }).map(v=>({item:v,isActual:false})),
  ];
  const materials=materialRows.map(({item,isActual})=>{
    const m=record(item)||{};const product=record(m['material'])||{};
    const plannedRow=plannedById.get(first(m['inventoryItemId'],m['materialId']))||{};
    const inventoryItemId=first(m['inventoryItemId'],m['materialId']);
    return {inventoryItemId,
      name:first(m['name'],m['materialName'],product['name'],inventoryItemId),
      templateQuantity:String(m['templateQuantity']??m['plannedQuantity']??plannedRow['quantity']??''),
      actualQuantity:isActual ? String(m['actualQuantity']??m['quantity']??'') : '',
      unit:first(m['unit'],product['unit']),
      note:first(m['note'],m['notes'],m['remark']),
      stockAfter:typeof (m['stockAfter']??m['afterQty'])==='number' ? Number(m['stockAfter']??m['afterQty']) : null,
      inventoryTransactionCode:first(m['inventoryTransactionCode'],m['inventoryTransactionId'],m['transactionCode'])};
  });
  const rawHistory=r['statusHistory']??r['auditHistory']??r['history'];
  const history=Array.isArray(rawHistory)?rawHistory.map(v=>{const h=record(v)||{};return {
    action:first(h['action'],h['status'],h['type']),
    at:date(h['at']??h['createdAt']),
    actor:first(h['actorName'],h['actorId']),note:first(h['note'],h['reason'])};
  }).filter(h=>h.action).sort((a,b)=>Date.parse(b.at||'')-Date.parse(a.at||'') || 0):[];
  const actions=r['allowedActions'];
  return {
    id,code:first(r['code'],r['recordCode'],r['service_record_code'])||id,
    appointmentId:first(r['appointmentId'],r['appointment_id'],appointment['id']),
    appointmentCode:first(r['appointmentCode'],appointment['code']),
    petId:first(r['petId'],pet['id'],pet['_id']),
    serviceIds:Array.isArray(r['serviceIds']) ? r['serviceIds'].map(str).filter(Boolean) : [],
    assignedStaffIds:Array.isArray(r['assignedStaffIds']) ? r['assignedStaffIds'].map(str).filter(Boolean) : [],
    date:date(r['date']??r['actualStartAt']??r['createdAt']??r['performedAt']),
    completedAt:date(r['completedAt']??r['actualEndAt']??r['finalizedAt']),
    petName:first(r['petName'],pet['name']),
    petDescription:first(r['petDescription'],pet['description']),
    serviceName:first(r['serviceName'],service['name']),
    branchName:first(r['branchName'],branch['name']),
    branchId:first(r['branchId'],branch['id'],branch['_id']),
    primaryStaff:first(r['primaryStaffName'],r['staffName'],staff['fullName'],staff['name']),
    primaryRole:first(r['primaryRole'],staff['role'],staff['jobRole']),
    category:cat,status:statusOf(rawStatus),rawStatus,
    note:first(r['resultNote'],r['result'],r['notes'],r['clinicalNotes'],prof?.['result'],prof?.['professionalNote']),
    nurseSegment:typeof nurse==='boolean'?nurse:null,
    veterinarianReview:vet,reviewedBy:first(review?.['reviewedBy'],review?.['reviewerName'],r['veterinarianName'],r['reviewerStaffId']),
    reviewedAt,
    allowedActions:Array.isArray(actions)?actions.filter((a):a is string=>typeof a==='string'):null,
    materials,history,
    recordVersion:typeof r['recordVersion']==='number'?r['recordVersion'] as number:null,
    version:typeof r['version']==='number'?r['version'] as number:null,
    reviewerStaffId:first(r['reviewerStaffId']),
    professional:prof?{
      diagnosis:first(prof['diagnosis']),treatment:first(prof['treatment']),
      result:first(prof['result']),professionalNote:first(prof['professionalNote']),
    }:null,
  };
}
export function normalizeServiceRecordsPage(raw:unknown):ServiceRecordsPage {
  const payload=unwrap(raw);const r=record(payload);
  const rows=Array.isArray(payload)?payload:Array.isArray(r?.['items'])?r['items']:
    Array.isArray(r?.['records'])?r['records']:null;
  if(!rows)throw new Error('Dữ liệu danh sách hồ sơ không hợp lệ.');
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
  if(r.category==='UNKNOWN')return {allowed:false,reason:'Chưa xác định loại hồ sơ.'};
  if(r.category==='MEDICAL' && !['IN_PROGRESS','WAITING_VET_REVIEW','REOPENED'].includes(r.status))
    return {allowed:false,reason:'Hồ sơ MEDICAL chưa ở trạng thái có thể được Bác sĩ thú y chốt.'};
  if(r.category==='GROOMING' && !['IN_PROGRESS','REOPENED'].includes(r.status))
    return {allowed:false,reason:'Hồ sơ GROOMING chưa ở trạng thái có thể chốt.'};
  return {allowed:true,reason:'Có thể thực hiện thao tác.'};
}
