import {
  ChangeDetectionStrategy, Component, DestroyRef, EventEmitter,
  Input, OnInit, Output, computed, inject, signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { catchError, from, map, mergeMap, of, toArray } from 'rxjs';

import { AdminToastService } from '../../../../shared/services/admin-toast.service';
import {
  BranchApiRecord, BranchManagementApiService, BranchServiceApiRecord,
} from '../../branch-management/services/branch-management-api.service';
import { CatalogService } from '../models/service-catalog.model';
import {
  BranchServiceConfigDialogComponent, BranchServiceConfigPreview,
} from './branch-service-config-dialog.component';

export interface DraftBranchSelection {
  branchId: string;
  branchName: string;
  enabled: boolean;
  capacity: number;
}
interface BranchOption {
  branch: BranchApiRecord;
  config: BranchServiceApiRecord | null;
  failed: boolean;
}

/**
 * Service Master → branches → the SAME service configuration dialog as Branch Detail.
 * All branch/config data and writes are sourced from the authenticated Backend.
 * The service's system status and each branch's status are distinct from live slot availability.
 */
@Component({
  selector: 'app-service-branch-config-flow',
  standalone: true,
  imports: [BranchServiceConfigDialogComponent],
  template: `
    @if (selectedBranch(); as choice) {
      <app-branch-service-config-dialog
        [service]="configuredService"
        [branches]="[{ id: choice.branch.id, name: choice.branch.name }]"
        [initialBranchId]="choice.branch.id"
        [branchActive]="choice.branch.status === 'ACTIVE'"
        [initialBlockedWindows]="[]"
        [saving]="saving()"
        (previewSaved)="save($event)"
        (dismiss)="closeEditor()" />
    } @else {
      <div class="branch-flow__overlay" role="presentation" (click)="dismiss.emit()">
        <section class="branch-flow__dialog" role="dialog" aria-modal="true"
          aria-labelledby="service-branches-heading" (click)="$event.stopPropagation()">
          <header class="branch-flow__header">
            <div>
              <h2 id="service-branches-heading">Cấu hình tại chi nhánh</h2>
              <p>{{ service.name }}</p>
            </div>
            <button type="button" class="branch-flow__close"
              (click)="dismiss.emit()" aria-label="Đóng">×</button>
          </header>
          @if (loading()) {
            <p class="branch-flow__message" role="status">Đang tải chi nhánh...</p>
          } @else if (error()) {
            <div class="branch-flow__message" role="alert">
              {{ error() }}
              <button type="button" (click)="load()">Thử lại</button>
            </div>
          } @else {
          <label class="branch-flow__search">
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none"
              stroke="currentColor" stroke-width="1.8" aria-hidden="true">
              <circle cx="10.8" cy="10.8" r="6.5"></circle><path d="m16 16 4.2 4.2"></path>
            </svg>
            <input #searchBox type="search" placeholder="Tìm chi nhánh..."
              aria-label="Tìm chi nhánh" [value]="search()" (input)="search.set(searchBox.value)" />
          </label>
            <div class="branch-flow__table-wrap">
              <table class="branch-flow__table">
                <thead><tr>
                  <th scope="col">Chi nhánh</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">Thao tác</th>
                </tr></thead>
                <tbody>
                  @for (option of filteredBranches(); track option.branch.id) {
                    <tr [class.branch-flow__preferred]="option.branch.id === preferredBranchId">
                      <td>{{ option.branch.name }}</td>
                      <td>
                        @if (option.branch.status !== 'ACTIVE') {
                          <span class="branch-flow__status branch-flow__status--off">Ngừng hoạt động</span>
                        } @else if (option.failed) {
                          <span class="branch-flow__status branch-flow__status--neutral">Không tải được</span>
                        } @else if (service.status !== 'ACTIVE') {
                          <span class="branch-flow__status branch-flow__status--off">Dịch vụ tạm ngưng</span>
                        } @else if (option.config !== null && option.config.enabled && option.config.capacity > 0) {
                          <span class="branch-flow__status">Đang bật</span>
                        } @else {
                          <span class="branch-flow__status branch-flow__status--off">Chưa bật</span>
                        }
                      </td>
                      <td>
                        <div class="branch-flow__actions">
                          <button type="button" class="branch-flow__icon-action"
                            [disabled]="option.failed"
                            [attr.aria-label]="'Cấu hình dịch vụ tại ' + option.branch.name"
                            title="Cấu hình dịch vụ" (click)="configure(option)">
                            <img src="/assets/service-catalog/icon-settings.svg" width="20" height="20" alt="" />
                          </button>
                          @if (!draftMode) {
                            <button type="button" class="branch-flow__icon-action"
                              [attr.aria-label]="'Xem chi tiết ' + option.branch.name"
                              title="Xem chi tiết chi nhánh" (click)="openBranch(option)">
                              <img src="/assets/admin-branch/figma-eye.svg" width="20" height="20" alt="" />
                            </button>
                          }
                        </div>
                      </td>
                    </tr>
                  } @empty {
                    <tr><td colspan="3" class="branch-flow__empty">Không có chi nhánh phù hợp.</td></tr>
                  }
                </tbody>
              </table>
            </div>
          }
        </section>
      </div>
    }
  `,
  styles: [`
    :host { font-family: Roboto,Arial,sans-serif; color:#1b273b; }
    .branch-flow__overlay { position:fixed; inset:0; z-index:1200; display:flex;
      align-items:center; justify-content:center; padding:16px; background:rgba(15,23,42,.55); }
    .branch-flow__dialog { width:min(100%,650px); max-height:calc(100dvh - 32px);
      overflow:auto; background:white; border-radius:12px; padding:24px;
      border:1px solid #e2e8f0; box-shadow:0 24px 65px rgba(0,0,0,.22); }
    .branch-flow__header {display:flex;justify-content:space-between;align-items:flex-start;
      gap:16px;border-bottom:1px solid #e2e8f0;padding-bottom:16px;}
    .branch-flow__header h2{font-size:19px;line-height:28px;margin:0;color:#1b273b;}
    .branch-flow__header p{font-size:13px;color:#64748b;margin:5px 0 0;}
    .branch-flow__close{border:0;background:transparent;font-size:25px;color:#64748b;cursor:pointer;}
    .branch-flow__search{display:flex;align-items:center;gap:8px;height:42px;
      padding:0 12px;margin:16px 0;border:1px solid #dce4ee;border-radius:8px;color:#64748b;}
    .branch-flow__search input{width:100%;min-width:0;border:0;outline:0;
      background:transparent;color:#1b273b;font:400 13px Roboto,Arial,sans-serif;}
    .branch-flow__table-wrap{max-height:340px;overflow:auto;border:1px solid #dce4ee;border-radius:8px;}
    .branch-flow__table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:13px;}
    .branch-flow__table th,.branch-flow__table td{padding:13px 14px;text-align:left;
      vertical-align:middle;box-sizing:border-box;}
    .branch-flow__table th{background:#f1f5f9;font-weight:500;color:#475569;font-size:12px;}
    .branch-flow__table th:nth-child(1){width:44%;}
    .branch-flow__table th:nth-child(2){width:27%;text-align:center;}
    .branch-flow__table th:nth-child(3){width:29%;text-align:center;}
    .branch-flow__table td:nth-child(2),.branch-flow__table td:nth-child(3){text-align:center;}
    .branch-flow__table td{border-top:1px solid #e2e8f0;}
    .branch-flow__preferred td{background:#f7fbff;}
    .branch-flow__status{display:inline-block;border-radius:99px;background:#e8f5e9;
      color:#2e7d32;padding:5px 10px;font-size:11px;white-space:nowrap;}
    .branch-flow__status--off{background:#eef1f4;color:#64748b;}
    .branch-flow__status--neutral{background:#fff4df;color:#96621b;}
    .branch-flow__actions{display:flex;align-items:center;justify-content:center;gap:14px;}
    .branch-flow__actions .branch-flow__icon-action{display:inline-flex;align-items:center;
      justify-content:center;width:36px;height:36px;padding:6px;border:0;border-radius:7px;
      background:transparent;cursor:pointer;}
    .branch-flow__icon-action img{display:block;width:20px;height:20px;object-fit:contain;}
    .branch-flow__actions .branch-flow__icon-action:hover{background:#eaf3ff;}
    .branch-flow__actions .branch-flow__icon-action:focus-visible{outline:2px solid #0d47a1;outline-offset:2px;}
    .branch-flow__actions button:disabled{opacity:.35;cursor:not-allowed;}
    .branch-flow__message{padding:20px;text-align:center;color:#536783;font-size:13px;}
    .branch-flow__message button{margin-left:8px;border:0;background:none;color:#0d47a1;cursor:pointer;}
    .branch-flow__empty{text-align:center;color:#64748b;}
    @media(max-width:620px){.branch-flow__dialog{padding:16px;}
      .branch-flow__actions{flex-wrap:wrap;gap:4px 12px;}
      .branch-flow__table{min-width:530px;}}
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ServiceBranchConfigFlowComponent implements OnInit {
  private readonly api = inject(BranchManagementApiService);
  private readonly toast = inject(AdminToastService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  @Input({ required: true }) service!: CatalogService;
  @Input() preferredBranchId = 'ALL';
  @Input() directBranchId: string | null = null;
  @Input() draftMode = false;
  @Input() draftConfigs: readonly DraftBranchSelection[] = [];
  @Output() readonly draftSaved = new EventEmitter<DraftBranchSelection>();
  @Output() readonly dismiss = new EventEmitter<void>();
  @Output() readonly saved = new EventEmitter<void>();

  readonly loading = signal(true);
  readonly saving = signal(false);
  readonly error = signal('');
  readonly search = signal('');
  readonly branches = signal<readonly BranchOption[]>([]);
  readonly selectedBranch = signal<BranchOption | null>(null);
  readonly filteredBranches = computed(() => {
    const q = this.search().trim().toLocaleLowerCase('vi');
    return this.branches().filter(({branch}) =>
      !q || branch.name.toLocaleLowerCase('vi').includes(q));
  });
  get configuredService(): CatalogService {
    const choice = this.selectedBranch();
    if (!choice) return this.service;
    return {
      ...this.service,
      branchServices: [{
        branchId: choice.branch.id,
        enabled: choice.config?.enabled ?? false,
        capacity: choice.config?.capacity ?? 0,
        availability: 'BY_SHIFT',
      }],
    };
  }

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    this.api.listBranches().pipe(
      mergeMap((branches) => this.draftMode
        ? of(branches.map((branch): BranchOption => {
            const draft = this.draftConfigs.find((config) => config.branchId === branch.id);
            return {
              branch,
              config: draft ? {
                branchId: branch.id,
                serviceId: this.service.id,
                enabled: draft.enabled,
                capacity: draft.capacity,
                availability: [],
              } : null,
              failed: false,
            };
          }))
        : from(branches).pipe(
        mergeMap((branch) => this.api.listServiceConfigs(branch.id).pipe(
          map((configs): BranchOption => ({
            branch,
            config: configs.find((item) => item.serviceId === this.service.id) ?? null,
            failed: false,
          })),
          catchError(() => of({branch, config:null, failed:true} as BranchOption)),
        ), 4),
        toArray(),
      )),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (rows) => {
        this.branches.set(rows.sort((a,b) => {
          if (a.branch.id === this.preferredBranchId) return -1;
          if (b.branch.id === this.preferredBranchId) return 1;
          return a.branch.name.localeCompare(b.branch.name, 'vi');
        }));
        this.loading.set(false);
        if (this.directBranchId) {
          const requested = this.branches().find((entry) => entry.branch.id === this.directBranchId);
          if (requested && !requested.failed) this.configure(requested);
        }
      },
      error: () => {
        this.error.set('Không tải được danh sách chi nhánh. Vui lòng thử lại.');
        this.loading.set(false);
      },
    });
  }

  configure(option: BranchOption): void {
    if (option.failed) return;
    this.selectedBranch.set(option);
  }

  closeEditor(): void {
    if (this.saving()) return;
    if (this.directBranchId) this.dismiss.emit();
    else this.selectedBranch.set(null);
  }

  openBranch(option: BranchOption): void {
    this.dismiss.emit();
    void this.router.navigate(['/admin/branches',option.branch.id], {
      queryParams: { tab: 'services', serviceId: this.service.id },
    });
  }

  save(payload: BranchServiceConfigPreview): void {
    if (this.saving()) return;
    if (payload.blockedWindows.length > 0) {
      this.toast.show('Chức năng lưu khoảng tạm khóa hiện chưa khả dụng.', 'info');
      return;
    }
    if (!Number.isInteger(payload.capacity) || payload.capacity < 1) {
      this.toast.show('Sức chứa đồng thời phải từ 1 trở lên.', 'error');
      return;
    }
    const choice = this.selectedBranch();
    if (!choice || choice.branch.id !== payload.branchId || payload.serviceId !== this.service.id) return;
    if (choice.branch.status !== 'ACTIVE' && payload.enabled) {
      this.toast.show('Không thể bật dịch vụ khi chi nhánh ngừng hoạt động.', 'error');
      return;
    }
    if (this.draftMode) {
      // Creating a Service Master requires a real server-side ID. Keep these
      // branch settings in the form until POST /services succeeds.
      this.draftSaved.emit({
        branchId: choice.branch.id,
        branchName: choice.branch.name,
        enabled: payload.enabled,
        capacity: payload.capacity,
      });
      this.dismiss.emit();
      return;
    }
    this.saving.set(true);
    this.api.updateServiceConfig(payload.branchId,payload.serviceId,{
      capacity:payload.capacity,
      enabled:payload.enabled,
      availability:choice.config?.availability ?? [],
    }).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: () => {
        this.saving.set(false);
        this.toast.show('Lưu cấu hình dịch vụ thành công.', 'success');
        this.selectedBranch.set(null);
        this.saved.emit();
        this.dismiss.emit();
      },
      error: () => {
        this.saving.set(false);
        this.toast.show('Không lưu được cấu hình dịch vụ. Vui lòng thử lại.', 'error');
      },
    });
  }
}
