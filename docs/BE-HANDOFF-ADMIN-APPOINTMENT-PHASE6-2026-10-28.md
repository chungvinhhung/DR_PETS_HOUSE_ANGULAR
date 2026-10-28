# WEB 2 — FE ↔ BE handoff | Appointment E2E Phase 6
Ngày: 2026-10-28 | Nhánh: `feature/admin-appointments-figma` | PR #33 (Draft)
**Phạm vi:** ServiceRecord (MEDICAL/GROOMING), Nurse → Veterinarian review, vật liệu sử dụng, mock refund, audit và checklist E2E WBS 4.3.
**Lưu ý:** Mọi endpoint dưới đây là **đề xuất cần BE xác nhận**, không phải cam kết API đã tồn tại.

## 1. Figma đối chiếu
- Service Records list: https://www.figma.com/design/vak640d4oft2Azmhu7HoGM/WEB-2?node-id=6336-25285
- Service Record detail: https://www.figma.com/design/vak640d4oft2Azmhu7HoGM/WEB-2?node-id=6336-25795
- Appointments list: https://www.figma.com/design/vak640d4oft2Azmhu7HoGM/WEB-2?node-id=6113-17463
- Chưa thấy màn Figma Admin thể hiện đầy đủ Nurse→Veterinarian review, mock refund và override audit; FE đã bổ sung khu vực dữ liệu nhưng vẫn cần Figma cập nhật/duyệt.

## 2. Frontend đã code
- `/admin/service-records`: bảng Mã hồ sơ / Ngày / Thú cưng / Dịch vụ / Chi nhánh / Nhân viên chính / Loại hồ sơ / Trạng thái / Thao tác. Tra cứu và lọc loại/trạng thái; branch filter khóa vì API scope chưa xác minh.
- `/admin/service-records/:id`: read-only chi tiết thông tin thực hiện, liên kết Appointment nếu BE trả ID, kết quả/ghi chú, vật tư template vs thực tế, lịch sử audit, MEDICAL Nurse/Veterinarian review. Nút mở lại/kiểm tra finalize không gọi mutation khi thiếu contract.
- `/admin/appointments/:id`: hiển thị liên kết ServiceRecord, Refund summary và override audit theo dữ liệu server nếu có; không tự tính tiền hoàn hoặc tạo nhật ký.
- Không có dữ liệu mẫu; lỗi API không bị đổi thành danh sách rỗng giả; không suy ra payment success/REFUNDED từ CANCELLED.

## 3. Hợp đồng ServiceRecord cần BE chốt (P0)
### Danh sách
Đề xuất `GET /api/v1/admin/service-records?page=&limit=&search=&type=&status=&branchId=`.
- Trả `items`, `total`, `nextCursor` hoặc pagination hợp lệ; chỉ dữ liệu branch thuộc quyền người dùng.
- Fields: `id,code,createdAt,pet,service,branch,primaryStaff,recordType,status`.
- Quyền: ADMIN toàn cục; MANAGER chỉ chi nhánh được giao; Nurse/Groomer/Veterinarian được phép trong phạm vi được phân công; Receptionist chỉ phần phù hợp quyền, BE trả 403 khi vượt quyền.

### Chi tiết
Đề xuất `GET /api/v1/admin/service-records/:id`.
- Fields cơ bản: `id,code,appointmentId,pet,service,branch,primaryStaff,recordType,status,resultNote,completedAt`.
- `segments`: service segment ID, role bắt buộc, nhân viên thực hiện, start/end, kết quả, Nurse segment marker.
- `veterinarianReview`: `status`, `reviewedBy`, `reviewedAt`, `note`, `reviewRequired`.
- `materials`: material/stock ID, unit, templateQuantity, actualQuantity, note; BE xử lý xuất/nhập kho phù hợp, có log, FE không tự trừ tồn.
- `allowedActions` từ BE sau khi kiểm tra quyền, branch, status, review. `auditHistory` append-only, gồm actor, timestamp, action, before/after, reason, override metadata.

## 4. MEDICAL Nurse → Veterinarian (P0)
- Khi một MEDICAL appointment có Nurse segment, phải có bước Veterinarian review theo rule WBS 4.3 trước khi ServiceRecord được finalize.
- Nurse có thể ghi nhận segment / đề nghị review nhưng **không tự duyệt thay Veterinarian**.
- Chỉ Veterinarian có thẩm quyền mới approve/reject review. Quyền theo branch, shift/assignment và trạng thái phải được BE xác minh.
- `POST /api/v1/admin/service-records/:id/submit-review` (đề xuất) → `PENDING_REVIEW`.
- `POST /api/v1/admin/service-records/:id/vet-review` (đề xuất) → `APPROVED/REJECTED`, note, actor, at.
- `POST /api/v1/admin/service-records/:id/finalize` (đề xuất) → BE chặn nếu yêu cầu review chưa được approve, hoặc record chưa đầy đủ.
- `POST /api/v1/admin/service-records/:id/reopen` (đề xuất) → chỉ vai trò được cấp, lý do bắt buộc, audit append-only, không xóa lịch sử đã finalize.
- BE phải giải thích các trạng thái `IN_PROGRESS`, `AWAITING_VET_REVIEW`, `COMPLETED`, `REOPENED` chính thức. Không dùng nhãn UI tự đặt làm enum BE.

## 5. Mock Refund Appointment (P0)
- Cần chốt refund rule theo thanh toán `ONLINE_MOCK` 100% và `PAY_AT_STORE` cọc 30%, phụ thuộc thời hạn hủy 24h và override.
- Trường tối thiểu: `refundId,appointmentId,paymentId,status,requestedAmount,settledAmount,requestedAt,settledAt,reason,actor,overrideAuditId`.
- **Không** suy ra `REFUNDED` từ `CANCELLED`; một lịch hủy có thể vẫn `REFUND_PENDING`, `REFUND_FAILED`, hoặc không được hoàn theo rule.
- Đề xuất `GET /api/v1/admin/appointments/:id/refund` và mutation idempotent do BE quyết định. Chỉ số tiền BE ghi nhận thực trả mới hiển thị là "Hoàn cuối cùng".
- Hoàn Voucher quota/slot nếu đáp ứng điều kiện, không tạo double refund khi retry, không lộ dữ liệu ngoài branch.
- Audit phải thể hiện override 24h và ai duyệt/ghi nhận hoàn mock.

## 6. Audit (P0)
- Nhật ký lưu tại BE, append-only, không lấy từ suy đoán các trạng thái FE.
- Fields: event id, action, actor id/role, appointment id/serviceRecord id, before→after, occurredAt (ISO UTC + timezone display), reason, isOverride, requestId/idempotencyKey.
- Theo dõi các sự kiện BOOK/CONFIRM/ASSIGN_STAFF/RESCHEDULE/CANCEL/OVERRIDE/REFUND_REQUEST/REFUND_DONE/RECORD_SUBMIT/RECORD_REVIEW/RECORD_FINALIZE/REOPEN.
- Server clock là nguồn sự thật cho cutoff 24h, max 2 reschedules và số lần thực sự đã thực hiện.

## 7. Bài test E2E phải chạy chung FE + BE (chưa thực thi)
| ID | Trường hợp | Kết quả kỳ vọng |
|---|---|---|
| E01 | BOOKABLE 1 thú + 1 dịch vụ; còn slot | Backend tạo lịch + giữ đúng capacity |
| E02 | Nhiều dịch vụ với nhiều requiredStaffRole | Segments nối tiếp; role phù hợp |
| E03 | MEDICAL có Nurse segment | Review của Veterinarian bắt buộc trước finalize |
| E04 | Bỏ qua review bằng request giả | BE từ chối finalize |
| E05 | REQUEST_ONLY/CONTACT_ONLY | Không self-book bằng flow BOOKABLE |
| E06 | 2 request lấy slot cuối đồng thời | Tối đa 1 giao dịch thành công |
| E07 | ONLINE_MOCK | Mock charge 100% từ quote chính thức |
| E08 | PAY_AT_STORE | Mock deposit 30%; còn 70% tại phòng khám |
| E09 | Apply voucher rồi bỏ Checkout | Chưa tiêu quota voucher |
| E10 | Hủy ở mốc ≥24h | Áp đúng rule BE; audit và refund trạng thái độc lập |
| E11 | Hủy <24h Receptionist không override | BE từ chối |
| E12 | Manager/Admin override kèm lý do | Chỉ thành công khi đúng quyền, có audit |
| E13 | Đổi lịch 2 lần + lần 3 | Lần 3 từ chối trừ override hợp lệ |
| E14 | Refund mock retry/timeout | Không duplicate refund, có reconciliation |
| E15 | Vật liệu thực tế khác template | ServiceRecord lưu thực tế và inventory movement đúng |
| E16 | GROOMING finalize đúng role | Hoàn thành và lưu thời điểm, không cần vet review |
| E17 | Reopen completed record | Kiểm tra permission, reason, append-only audit |
| E18 | Manager/Staff vượt branch | 403; không lộ khách, thú cưng, bệnh án |
| E19 | Payment thất bại sau slot quote | Không tạo success giả hoặc chiếm vĩnh viễn slot/quota |
| E20 | FE refresh, search, filter, pagination | Không trả dữ liệu mẫu; render dữ liệu server thực |

**Tiêu chí nghiệm thu:** FE build thành công chỉ là điều kiện kỹ thuật; chưa được đánh dấu E2E hoàn tất khi chưa có xác nhận contract, tài khoản staging từng vai trò, seeded data và kết quả test có bằng chứng.

## 8. Các điểm cần BE/Figma phản hồi trước khi merge
1. API list/detail ServiceRecord thật + quyền theo role/branch + trạng thái chính thức.
2. MEDICAL/Nurse/Vet review schema/action và hồ sơ bệnh án bắt buộc.
3. Refund mock workflow và rule số tiền hoàn, audit/idempotency.
4. Link Appointment ↔ ServiceRecord ↔ Payment/Refund, source of truth.
5. Figma màn MEDICAL review, reopen record, mock refund và audit.
6. Kết quả E2E từng case ở trên; FE hoàn thiện mutation sau khi BE bàn giao.
