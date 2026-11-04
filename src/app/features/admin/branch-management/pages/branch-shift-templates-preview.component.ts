import { ChangeDetectionStrategy, Component, Input, OnChanges, OnInit, SimpleChanges, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { AdminDataStateComponent } from '../../../../shared/admin-data-state/admin-data-state.component';
import { AdminStaffWeekNavComponent } from '../../staff/components/admin-staff-week-nav.component';
import { AdminStaffApiService, staffTodayISO, staffWeekMonday } from '../../staff/services/admin-staff-api.service';
import { formatStaffWeekRange } from '../../staff/utils/staff-week-range';

@Component({
  selector: 'app-branch-shift-templates-preview',
  standalone: true,
  imports: [RouterLink, AdminDataStateComponent, AdminStaffWeekNavComponent],
  template: `
    <section class="branch-management__panel branch-v2" aria-labelledby="branch-shift-heading">
      <div class="branch-v2__heading">
        <div><h2 id="branch-shift-heading">Ca làm việc tại chi nhánh</h2></div>
        <a class="branch-management__button branch-management__button--primary" routerLink="/admin/staff/schedule">
          Quản lý lịch làm việc
        </a>
      </div>

      <app-admin-staff-week-nav
        [monday]="monday()"
        [label]="weekLabel()"
        (previousWeek)="moveWeek(-1)"
        (nextWeek)="moveWeek(1)"
        (currentWeek)="goToday()"
        (dateSelected)="chooseDate($event)">
      </app-admin-staff-week-nav>

      <div class="branch-management__table-scroll">
        @if (staffApi.loading() || staffApi.shiftLoading()) {
          <app-admin-data-state kind="loading" title="Đang tải ca làm việc" />
        } @else if (staffApi.error()) {
          <app-admin-data-state kind="error" title="Không thể tải danh sách nhân sự" [message]="staffApi.error()" (retry)="retry()" />
        } @else if (staffApi.shiftError()) {
          <app-admin-data-state kind="error" title="Không thể tải ca làm việc" [message]="staffApi.shiftError()" (retry)="retry()" />
        } @else {
          <table class="branch-management__table branch-v2__shifts">
            <colgroup>
              <col style="width: 23%" />
              <col style="width: 17%" />
              <col style="width: 18%" />
              <col style="width: 22%" />
              <col style="width: 12%" />
              <col style="width: 8%" />
            </colgroup>
            <thead><tr>
              <th scope="col">Nhân viên</th><th scope="col">Vai trò</th><th scope="col">Ngày</th>
              <th scope="col">Khung giờ</th><th scope="col">Trạng thái</th><th scope="col">Thao tác</th>
            </tr></thead>
            <tbody>
              @for (row of rows(); track row.shiftId) {
                <tr>
                  <td><strong>{{ staffName(row.staffId) }}</strong></td>
                  <td>{{ staffRole(row.staffId) }}</td>
                  <td>{{ dateLabel(row.isoDate) }}</td>
                  <td>{{ row.time }}</td>
                  <td><span class="branch-management__pill">Đang áp dụng</span></td>
                  <td class="branch-v2__edit-cell">
                    <a class="branch-v2__edit-icon" [routerLink]="['/admin/staff', row.staffId]"
                      title="Xem nhân viên" [attr.aria-label]="'Xem nhân viên ' + staffName(row.staffId)">
                      <img src="/assets/admin-branch/figma-eye.svg" width="20" height="20" alt="" />
                    </a>
                  </td>
                </tr>
              } @empty {
                <tr><td colspan="6"><app-admin-data-state kind="empty" title="Chưa có ca làm việc" message="Chi nhánh này chưa có ca làm việc trong tuần đang xem." /></td></tr>
              }
            </tbody>
          </table>
        }
      </div>
    </section>
  `,
  styles: [`
    :host{display:block;min-width:0}
    .branch-v2__heading{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-bottom:14px}
    .branch-v2__heading h2{margin:0}
    .branch-management__button{text-decoration:none}
    .branch-management__table-scroll{width:100%;overflow-x:auto;border:1px solid #dce4ee;border-radius:10px;background:#fff}
    .branch-v2__shifts{width:100%;min-width:780px;border-collapse:collapse;table-layout:fixed;font:400 13px/20px Roboto,Arial,sans-serif;color:#334155}
    .branch-v2__shifts thead{background:#f2f7fc}
    .branch-v2__shifts :is(th,td){box-sizing:border-box;padding:12px 16px;text-align:left;vertical-align:middle}
    .branch-v2__shifts th{height:54px;color:#475569;font:600 13px/20px Roboto,Arial,sans-serif;white-space:nowrap}
    .branch-v2__shifts td{height:68px;border-top:1px solid #e2e8f0;font-size:14px}
    .branch-v2__shifts :is(th,td):last-child{text-align:center;padding-inline:12px}
    .branch-management__pill{display:inline-flex;align-items:center;border:1px solid #c8e6c9;border-radius:999px;background:#e8f5e9;color:#2e7d32;padding:4px 10px;font-size:12px;white-space:nowrap}
    .branch-v2__edit-icon{display:inline-flex;justify-content:center;align-items:center;width:32px;height:32px;border-radius:6px}
    .branch-v2__edit-icon:hover{background:#e5f6fd}
    .branch-v2__edit-icon img{display:block}
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchShiftTemplatesPreviewComponent implements OnInit, OnChanges {
  readonly staffApi=inject(AdminStaffApiService);

  @Input() branchId='';
  @Input() branchName='Chi nhánh';

  readonly monday=signal(staffWeekMonday(staffTodayISO()));
  readonly weekLabel=computed(()=>formatStaffWeekRange(this.monday()));
  readonly rows=computed(()=>this.staffApi.shifts()
    .filter(shift=>!this.branchId || shift.branchId===this.branchId)
    .sort((a,b)=>a.isoDate.localeCompare(b.isoDate)||a.time.localeCompare(b.time)));

  ngOnInit():void {
    this.staffApi.loadRoster();
    this.staffApi.loadWeek(this.monday());
  }

  ngOnChanges(changes:SimpleChanges):void {
    if(changes['branchId']&&!changes['branchId'].firstChange)this.staffApi.loadWeek(this.monday(),true);
  }

  retry():void {
    if(this.staffApi.error())this.staffApi.loadRoster(true);
    this.staffApi.loadWeek(this.monday(),true);
  }

  moveWeek(delta:number):void {
    const date=new Date(this.monday()+'T00:00:00Z');
    date.setUTCDate(date.getUTCDate()+delta*7);
    this.monday.set(date.toISOString().slice(0,10));
    this.staffApi.loadWeek(this.monday(),true);
  }

  goToday():void {
    this.monday.set(staffWeekMonday(staffTodayISO()));
    this.staffApi.loadWeek(this.monday(),true);
  }

  chooseDate(value:string):void {
    if(!/^\d{4}-\d{2}-\d{2}$/.test(value))return;
    this.monday.set(staffWeekMonday(value));
    this.staffApi.loadWeek(this.monday(),true);
  }

  staffName(staffId:string):string {
    return this.staffApi.staff().find(staff=>staff.id===staffId)?.fullName||'Nhân viên';
  }

  staffRole(staffId:string):string {
    const role=this.staffApi.staff().find(staff=>staff.id===staffId)?.jobRole;
    return role==='VETERINARIAN'?'Bác sĩ thú y':
      role==='NURSE'?'Y tá':
      role==='CARE_STAFF'?'Nhân viên chăm sóc':
      role==='RECEPTIONIST'?'Lễ tân':
      role==='MANAGER'?'Quản lý':'—';
  }

  dateLabel(value:string):string {
    const [y,m,d]=value.split('-');
    return y&&m&&d?d+'/'+m+'/'+y:value;
  }
}
