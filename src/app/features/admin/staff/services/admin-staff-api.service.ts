import { HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import { catchError, expand, forkJoin, map, Observable, of, reduce, throwError } from 'rxjs';

import { ApiClientService } from '../../../../core/services/api-client.service';
import { AuthSessionService } from '../../../../core/services/auth-session.service';
import { JobRole, StaffPreview, StaffShiftPreview } from '../models/staff-preview.model';

type Page<T> = T[] | { items: T[]; nextCursor?: string | null; data?: never } |
  { data: T[] | { items: T[]; nextCursor?: string | null } };

interface UserWire {
  _id?: string;
  id?: string;
  fullName?: string;
  name?: string;
  phone?: string;
  email?: string;
  username?: string;
  accountStatus?: string;
  status?: string;
}
interface StaffWire {
  _id?: string;
  id?: string;
  code?: string;
  staffCode?: string;
  fullName?: string;
  phone?: string;
  email?: string;
  staffSubRole?: string;
  jobRole?: string;
  userId?: string | UserWire;
  authorizedBranchIds?: (string | { _id?: string; id?: string })[];
  homeBranchId?: string | { _id?: string; id?: string };
  accountStatus?: string;
  status?: string;
}
interface BranchWire { id?: string; _id?: string; name?: string; branchName?: string; }
interface ShiftWire {
  id?: string; _id?: string; staffId?: string; branchId?: string;
  startAt?: string; endAt?: string; status?: string;
}

export interface StaffBranchOption { id: string; name: string; }

function idOf(input: string | { id?: string; _id?: string } | null | undefined): string {
  if (typeof input === 'string') return input;
  return input?.id ?? input?._id ?? '';
}
function unboxPage<T>(wire: unknown): { items: T[]; nextCursor: string | null } {
  const outer = wire as Page<T> | null;
  const inner = outer && !Array.isArray(outer) && 'data' in outer ? outer.data : outer;
  if (Array.isArray(inner)) return { items: inner, nextCursor: null };
  if (!inner || !('items' in inner) || !Array.isArray(inner.items)) {
    throw new Error('API Staff/Shift trả về dữ liệu không đúng hợp đồng.');
  }
  return { items: inner.items, nextCursor: inner.nextCursor ?? null };
}

const calendar = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit', year: 'numeric',
});
const hours = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Ho_Chi_Minh', hour: '2-digit', minute: '2-digit', hour12: false,
});
function dateKey(value: string): string {
  const parts = calendar.formatToParts(new Date(value));
  const take = (key: string) => parts.find(p => p.type === key)?.value ?? '';
  return `${take('year')}-${take('month')}-${take('day')}`;
}
function clock(value: string): string { return hours.format(new Date(value)); }
export function staffTodayISO(): string { return dateKey(new Date().toISOString()); }
export function staffWeekMonday(day: string): string {
  const d = new Date(day + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - (d.getUTCDay() + 6) % 7);
  return d.toISOString().slice(0, 10);
}
function changeDay(day: string, n: number): string {
  return new Date(Date.parse(day + 'T00:00:00Z') + n * 86400000).toISOString().slice(0, 10);
}
function safeRole(role: string | undefined): JobRole {
  switch (role) {
    case 'NURSE': case 'RECEPTIONIST': case 'VETERINARIAN': case 'MANAGER':
      return role;
    case 'CARE_STAFF_GROOMER': case 'CARE_STAFF': return 'CARE_STAFF';
    default: return 'CARE_STAFF';
  }
}
function errorText(error: unknown, resource: string): string {
  const http = error as HttpErrorResponse;
  if (http?.status === 401) return 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.';
  if (http?.status === 403) return 'Bạn không có quyền xem dữ liệu ' + resource + ' của chi nhánh này.';
  if (http?.status === 404) return 'Backend trên Render chưa cung cấp API ' + resource + '.';
  return 'Không thể tải ' + resource + ' từ Backend. Kiểm tra kết nối Render và API.';
}

/**
 * Task 3.8 API adapter. Never substitutes Figma fixtures after an API failure.
 * The deployed BE may differ from the foundation-v6 contracts; surface errors rather
 * than writing to undocumented account-creation/reset/profile endpoints.
 */
@Injectable({ providedIn: 'root' })
export class AdminStaffApiService {
  private readonly api = inject(ApiClientService);
  private readonly session = inject(AuthSessionService);
  readonly staff = signal<readonly StaffPreview[]>([]);
  readonly branches = signal<readonly StaffBranchOption[]>([]);
  readonly shifts = signal<readonly StaffShiftPreview[]>([]);
  readonly loading = signal(false);
  readonly loaded = signal(false);
  readonly error = signal('');
  readonly shiftLoading = signal(false);
  readonly shiftError = signal('');
  readonly loadedMonday = signal('');

  private getAll<T>(path: string, params = new HttpParams()): Observable<T[]> {
    return this.api.get<unknown>(path, { params: params.set('limit', '100') }).pipe(
      map((raw) => ({ ...unboxPage<T>(raw), index: 0 })),
      expand((page) => page.nextCursor && page.index < 19
        ? this.api.get<unknown>(path, { params: params.set('limit', '100').set('cursor', page.nextCursor) }).pipe(
          map(raw => ({ ...unboxPage<T>(raw), index: page.index + 1 })),
        ) : page.nextCursor ? throwError(() => new Error('API phân trang vượt quá 20 trang; cần lọc server.')) : of()),
      reduce((all, page) => [...all, ...page.items], [] as T[]),
    );
  }

  private listBranches(): Observable<StaffBranchOption[]> {
    return this.getAll<BranchWire>('/branches').pipe(
      map(rows => rows.map(b => ({ id: idOf(b.id ?? b._id), name: b.name ?? b.branchName ?? '' }))
        .filter(b => !!b.id && !!b.name)),
    );
  }

  private staffFromWire(input: StaffWire, branchNames: ReadonlyMap<string, string>): StaffPreview | null {
    const id = idOf(input.id ?? input._id);
    if (!id) return null;
    const account = typeof input.userId === 'object' ? input.userId : undefined;
    const ids = (input.authorizedBranchIds ?? []).map(idOf).filter(Boolean);
    const homeId = idOf(input.homeBranchId);
    const rawStatus = input.accountStatus ?? account?.accountStatus ?? account?.status ?? '';
    // StaffProfile.status (ACTIVE/INACTIVE) is NOT an account-block flag.
    const accountStatus: StaffPreview['accountStatus'] = rawStatus === 'BLOCKED' ? 'BLOCKED' :
      rawStatus === 'ACTIVE' ? 'ACTIVE' : 'UNKNOWN';
    return {
      id,
      staffCode: input.staffCode ?? input.code ?? '',
      fullName: input.fullName ?? account?.fullName ?? account?.name ?? 'Chưa cập nhật họ tên',
      jobRole: safeRole(input.staffSubRole ?? input.jobRole),
      branchIds: ids,
      branches: ids.map(b => branchNames.get(b) ?? b),
      homeBranchId: homeId,
      homeBranch: homeId ? (branchNames.get(homeId) ?? homeId) : undefined,
      phone: input.phone ?? account?.phone,
      email: input.email ?? account?.email,
      loginUsername: account?.username,
      todayShift: '—',
      accountStatus,
    };
  }

  loadRoster(force = false): void {
    if (this.loading() || (this.loaded() && !force)) return;
    this.error.set('');
    this.loading.set(true);
    this.loaded.set(false);
    // The foundation-v6 /staff route does not enforce Manager branch scope.
    // Do not expose its unscoped records to MANAGER through this UI.
    if (!this.session.hasAnyRole(['ADMIN'])) {
      this.staff.set([]);
      this.loading.set(false);
      this.error.set('API Staff hiện chưa xác minh phân quyền chi nhánh cho Manager. Cần Backend cập nhật trước khi hiển thị dữ liệu.');
      return;
    }
    forkJoin({
      profiles: this.getAll<StaffWire>('/staff'),
      branches: this.listBranches().pipe(catchError(() => of([] as StaffBranchOption[]))),
    }).subscribe({
      next: ({ profiles, branches }) => {
        this.branches.set(branches);
        const byId = new Map(branches.map(b => [b.id, b.name]));
        this.staff.set(profiles.map(p => this.staffFromWire(p, byId)).filter((s): s is StaffPreview => s !== null));
        this.loaded.set(true);
        this.loading.set(false);
      },
      error: err => {
        this.staff.set([]); this.loaded.set(false); this.loading.set(false);
        this.error.set(errorText(err, 'Staff'));
      },
    });
  }

  loadWeek(monday: string): void {
    if (this.shiftLoading() || (this.loadedMonday() === monday && !this.shiftError())) return;
    this.shiftLoading.set(true); this.shiftError.set(''); this.shifts.set([]);
    this.loadedMonday.set('');
    const from = changeDay(monday, -1);
    const until = changeDay(monday, 7);
    this.getAll<ShiftWire>('/shifts', new HttpParams().set('dateFrom', from).set('dateTo', until)).subscribe({
      next: rows => {
        const map = new Map(this.branches().map(b => [b.id, b.name]));
        const end = changeDay(monday, 7);
        this.shifts.set(rows.filter(s => s.status !== 'CANCELLED' && s.startAt && s.endAt)
          .filter(s => dateKey(s.startAt!) >= monday && dateKey(s.startAt!) < end)
          .map(s => ({
            staffId: idOf(s.staffId),
            isoDate: dateKey(s.startAt!),
            branchId: idOf(s.branchId),
            branch: map.get(idOf(s.branchId)) ?? idOf(s.branchId),
            shiftName: 'Ca làm',
            time: `${clock(s.startAt!)}–${clock(s.endAt!)}`,
            shiftId: idOf(s.id ?? s._id),
          })));
        this.loadedMonday.set(monday);
        this.shiftLoading.set(false);
      },
      error: err => {
        this.shiftLoading.set(false); this.shiftError.set(errorText(err, 'Shift'));
      },
    });
  }
}
