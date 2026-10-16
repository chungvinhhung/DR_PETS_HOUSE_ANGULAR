import { ChangeDetectionStrategy, Component, ElementRef, ViewChild, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AdminCatalogShellComponent } from '../../../../shared/admin-catalog-shell/admin-catalog-shell.component';
import { AdminToastService } from '../../../../shared/services/admin-toast.service';
import { AuthSessionService } from '../../../../core/services/auth-session.service';
import {
  JOB_LABELS,
  STAFF_PREVIEW,
  STAFF_SHIFTS_PREVIEW,
  StaffPreview,
  StaffShiftPreview,
  displayStaffName,
  displayStaffShift,
} from '../models/staff-preview.model';

interface WeekDayRow {
  isoDate: string;
  label: string;
  weekday: string;
  dayMonth: string;
  shifts: readonly StaffShiftPreview[];
}

const DAY_IN_MS = 86_400_000;
const FIGMA_SAMPLE_MONDAY = '2026-10-19';

function dateFromISO(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}
function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
function shortDate(date: Date): string {
  return `${String(date.getUTCDate()).padStart(2, '0')}/${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}
function dayLabel(day: number): string {
  return day === 6 ? 'CN' : `Thứ ${day + 2}`;
}

@Component({
  selector: 'app-admin-staff-detail',
  standalone: true,
  imports: [RouterLink, AdminCatalogShellComponent],
  templateUrl: './admin-staff-detail.component.html',
  styleUrl: './admin-staff-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminStaffDetailComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly toast = inject(AdminToastService);
  private readonly session = inject(AuthSessionService);
  blockDialogOpen = false;
  @ViewChild('weekDatePicker') private weekDatePicker?: ElementRef<HTMLInputElement>;

  readonly staffId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly staff: StaffPreview | undefined = STAFF_PREVIEW.find(item => item.id === this.staffId);
  readonly weekMonday = signal(FIGMA_SAMPLE_MONDAY);
  readonly weeks = computed<readonly WeekDayRow[]>(() => {
    const startMs = dateFromISO(this.weekMonday()).getTime();
    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(startMs + i * DAY_IN_MS);
      const key = isoDate(date);
      return {
        isoDate: key,
        label: `${dayLabel(i)} · ${shortDate(date)}`,
        weekday: dayLabel(i),
        dayMonth: shortDate(date),
        shifts: STAFF_SHIFTS_PREVIEW.filter(s => s.staffId === this.staffId && s.isoDate === key),
      };
    });
  });
  readonly weekLabel = computed(() => {
    const monday = dateFromISO(this.weekMonday());
    const sunday = new Date(monday.getTime() + 6 * DAY_IN_MS);
    return `${shortDate(monday)} - ${shortDate(sunday)}/${sunday.getUTCFullYear()}`;
  });

  displayName(item: StaffPreview): string { return displayStaffName(item); }
  roleName(item: StaffPreview): string { return JOB_LABELS[item.jobRole]; }
  displayShift(value: string): string { return displayStaffShift(value); }

  moveWeek(weeks: number): void {
    const next = new Date(dateFromISO(this.weekMonday()).getTime() + weeks * 7 * DAY_IN_MS);
    this.weekMonday.set(isoDate(next));
  }
  openWeekDatePicker(): void {
    const picker = this.weekDatePicker?.nativeElement;
    if (!picker) return;
    // Use the native date picker when supported, with a focus/click fallback.
    if (typeof picker.showPicker === 'function') {
      try { picker.showPicker(); return; } catch { /* Some browsers disallow programmatic picker opening. */ }
    }
    picker.focus();
    picker.click();
  }

  selectWeekDate(value: string): void {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return;
    const selected = dateFromISO(value);
    if (Number.isNaN(selected.getTime()) || isoDate(selected) !== value) return;
    const daysFromMonday = (selected.getUTCDay() + 6) % 7;
    const monday = new Date(selected.getTime() - daysFromMonday * DAY_IN_MS);
    this.weekMonday.set(isoDate(monday));
  }

  get canBlockAccount(): boolean { return this.session.hasAnyRole(['ADMIN']); }
  openBlockConfirmation(): void {
    if (!this.canBlockAccount) {
      this.toast.show('Tài khoản không có quyền chặn hoặc bỏ chặn nhân viên.', 'error');
      return;
    }
    this.blockDialogOpen = true;
  }
  closeBlockConfirmation(): void {
    this.blockDialogOpen = false;
  }
  confirmBlockPreview(): void {
    this.blockDialogOpen = false;
    this.toast.show('Chưa có API Staff/Account. Chưa thay đổi trạng thái tài khoản.', 'info');
  }
  goBack(): void {
    void this.router.navigateByUrl('/admin/staff');
  }
}
