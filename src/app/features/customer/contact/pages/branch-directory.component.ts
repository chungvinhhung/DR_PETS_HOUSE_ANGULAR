import { ChangeDetectionStrategy, Component, DestroyRef, afterNextRender, computed, inject, signal } from '@angular/core';

import { BookingApiService } from '../../../../core/customer/services/api/booking-api.service';
import { BranchCardComponent } from './branch-card.component';
import { TrustResourceUrlPipe } from '../../../../shared/customer/pipes/trust-resource-url.pipe';
import { ReactStyleDirective } from '../../../../shared/customer/directives/react-style.directive';
import { BRANCHES, contactAssets } from '../data/contact-data';
import { getGoogleMapsLink, getGoogleMapsEmbedLink, normalizeContactBranch } from './contact-page.helpers';

/**
 * BranchDirectory — chuyển từ React: src/pages/Contact/ContactPage.jsx
 */
@Component({
  selector: 'section[app-branch-directory]',
  standalone: true,
  imports: [BranchCardComponent, TrustResourceUrlPipe, ReactStyleDirective],
  templateUrl: './branch-directory.component.html',
  host: {
    'class': 'contact-branches',
    'id': 'branches',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchDirectoryComponent {
  // --- Service dùng chung ---
  protected readonly bookingApi = inject(BookingApiService);
  private readonly destroyRef = inject(DestroyRef);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly contactAssets: any = contactAssets;
  protected readonly getGoogleMapsEmbedLink: any = getGoogleMapsEmbedLink;
  protected readonly getGoogleMapsLink: any = getGoogleMapsLink;

  // --- Giá trị tính toán (computed) ---
  readonly visibleBranches = computed<any>(() => {
    const keyword = this.query().trim().toLocaleLowerCase("vi");
    if (!keyword) return this.branches();

    return this.branches().filter((branch: any) =>
      `${branch.name} ${branch.address} ${branch.phone}`
        .toLocaleLowerCase("vi")
        .includes(keyword),
    );
  });
  readonly selectedBranch = computed<any>(() => this.branches().find((branch: any) => branch.id === this.activeBranch()) ?? this.branches()[0]);

  // --- Trạng thái (signal = useState / useRef) ---
  readonly query = signal<any>("");
  readonly branches = signal<any>((() => BRANCHES.map(normalizeContactBranch))());
  readonly activeBranch = signal<any>(String(BRANCHES[0]?.id ?? 1));
  readonly isLoadingBranches = signal<any>(false);
  readonly branchLoadError = signal<any>("");

  constructor() {
    // useEffect(..., []) -> chạy 1 lần sau khi render
    afterNextRender(() => {
      const cleanup = (() => {
        let ignore = false;
        this.isLoadingBranches.set(true);
        this.branchLoadError.set("");

        this.bookingApi.getBranches()
          .then((apiBranches: any) => {
            if (ignore || !apiBranches.length) return;
            const normalizedBranches = apiBranches.map(normalizeContactBranch);
            this.branches.set(normalizedBranches);
            this.activeBranch.update((current: any) =>
              normalizedBranches.some((branch: any) => branch.id === current)
                ? current
                : normalizedBranches[0].id);
          })
          .catch(() => {
            if (!ignore) this.branchLoadError.set("Đang hiển thị danh sách chi nhánh dự phòng.");
          })
          .finally(() => {
            if (!ignore) this.isLoadingBranches.set(false);
          });

        return () => {
          ignore = true;
        };
      })();
      if (typeof cleanup === 'function') this.destroyRef.onDestroy(cleanup);
    });
  }

}
