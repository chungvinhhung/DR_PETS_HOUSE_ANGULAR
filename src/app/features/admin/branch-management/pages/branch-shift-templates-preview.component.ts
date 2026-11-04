import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AdminDataStateComponent } from '../../../../shared/admin-data-state/admin-data-state.component';

/**
 * Branch-level shift templates are distinct from staff shift assignments.
 * The current BE only exposes /shifts with staffId/startAt/endAt, not a
 * branch shift-template CRUD contract. Do not fabricate template rows.
 */
@Component({
  selector: 'app-branch-shift-templates-preview',
  standalone: true,
  imports: [RouterLink, AdminDataStateComponent],
  template: `
    <section class="branch-management__panel branch-v2" aria-labelledby="branch-shift-heading">
      <div class="branch-v2__heading">
        <h2 id="branch-shift-heading">Ca làm việc tại chi nhánh</h2>
        <div class="branch-shifts__actions">
          <button type="button" class="branch-management__button branch-management__button--primary"
            disabled title="Chưa hỗ trợ tạo mẫu ca làm việc theo chi nhánh">
            Thêm ca làm việc
          </button>
          <a class="branch-management__button branch-management__button--outline"
             routerLink="/admin/staff/schedule">
            Quản lý lịch làm việc
          </a>
        </div>
      </div>
      <div class="branch-management__table-scroll">
        <table class="branch-management__table branch-v2__shifts">
          <colgroup>
            <col style="width:22%" /><col style="width:14%" /><col style="width:14%" />
            <col style="width:24%" /><col style="width:16%" /><col style="width:10%" />
          </colgroup>
          <thead>
            <tr>
              <th scope="col">Tên ca</th>
              <th scope="col">Bắt đầu</th>
              <th scope="col">Kết thúc</th>
              <th scope="col">Ngày áp dụng</th>
              <th scope="col">Trạng thái</th>
              <th scope="col">Thao tác</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td colspan="6">
                <app-admin-data-state kind="empty" title="Chưa có dữ liệu ca làm việc"
                  message="Chức năng quản lý mẫu ca làm việc tại chi nhánh chưa được hệ thống hỗ trợ." />
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  `,
  styles: [`
    :host{display:block;min-width:0}
    .branch-v2__heading{display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:12px;margin-bottom:14px}
    .branch-v2__heading h2{margin:0}
    .branch-shifts__actions{display:flex;align-items:center;justify-content:flex-end;flex-wrap:wrap;gap:10px}
    .branch-management__button{text-decoration:none;white-space:nowrap}
    .branch-management__button:disabled{cursor:not-allowed;background:#f1f5f9;border-color:#dce4ee;color:#94a3b8}
    .branch-management__table-scroll{width:100%;overflow-x:auto;border:1px solid #dce4ee;border-radius:10px;background:#fff}
    .branch-v2__shifts{width:100%;min-width:770px;border-collapse:collapse;table-layout:fixed;font:400 13px/20px Roboto,Arial,sans-serif;color:#334155}
    .branch-v2__shifts thead{background:#e5f6fd}
    .branch-v2__shifts :is(th,td){box-sizing:border-box;padding:12px 16px;text-align:left;vertical-align:middle}
    .branch-v2__shifts th{height:50px;color:#475569;font:600 13px/20px Roboto,Arial,sans-serif;white-space:nowrap}
    .branch-v2__shifts td{border-top:1px solid #e2e8f0}
    .branch-v2__shifts :is(th,td):last-child{text-align:center;padding-inline:12px}
    @media(max-width:650px){.branch-shifts__actions{justify-content:flex-start}}
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchShiftTemplatesPreviewComponent {
  @Input() branchId = '';
  @Input() branchName = '';
}
