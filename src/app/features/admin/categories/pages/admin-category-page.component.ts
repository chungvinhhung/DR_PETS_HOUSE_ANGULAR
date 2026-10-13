import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize } from 'rxjs';

import {
  AdminCategory,
  CategoryStatus,
  SaveCategoryRequest,
} from '../models/admin-category.model';
import { AdminCategoryService } from '../services/admin-category.service';

@Component({
  selector: 'app-admin-category-page',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './admin-category-page.component.html',
  styleUrl: './admin-category-page.component.scss',
  changeDetection: ChangeDetectionStrategy.Default,
})
export class AdminCategoryPageComponent implements OnInit {
  private readonly categoryService = inject(AdminCategoryService);
  private readonly destroyRef = inject(DestroyRef);

  readonly categories = signal<AdminCategory[]>([]);
  readonly parentOptions = signal<AdminCategory[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly nextCursor = signal<string | null>(null);
  readonly dialogOpen = signal(false);
  readonly errorMessage = signal('');
  readonly notice = signal('');
  readonly formError = signal('');

  searchTerm = '';
  statusFilter: 'ALL' | CategoryStatus = 'ALL';
  formName = '';
  formParentId = '';
  formStatus: CategoryStatus = 'ACTIVE';
  editing: AdminCategory | null = null;

  private currentCursor: string | null = null;
  private cursorStack: (string | null)[] = [];

  get hasPreviousPage(): boolean {
    return this.cursorStack.length > 0;
  }

  get pageNumber(): number {
    return this.cursorStack.length + 1;
  }

  ngOnInit(): void {
    this.loadPage(null);
    this.loadParentOptions();
  }

  private loadParentOptions(): void {
    this.categoryService.listCategories({ limit: 100 }).pipe(
      takeUntilDestroyed(this.destroyRef),
    ).subscribe({
      next: (response) => this.parentOptions.set(response.items),
      error: () => {
        // Listing still works even when the parent selector cannot be loaded.
        this.parentOptions.set([]);
      },
    });
  }

  loadPage(cursor: string | null): void {
    if (this.loading()) return;
    this.loading.set(true);
    this.errorMessage.set('');
    this.categoryService.listCategories({
      q: this.searchTerm,
      status: this.statusFilter === 'ALL' ? undefined : this.statusFilter,
      limit: 20,
      cursor,
    }).pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.loading.set(false)),
    ).subscribe({
      next: (response) => {
        this.categories.set(response.items);
        this.nextCursor.set(response.nextCursor);
        this.currentCursor = cursor;
      },
      error: (err: unknown) => {
        this.errorMessage.set(this.errorText(err, 'Không thể tải danh sách danh mục.'));
      },
    });
  }

  applyFilters(): void {
    this.cursorStack = [];
    this.currentCursor = null;
    this.loadPage(null);
  }

  nextPage(): void {
    const cursor = this.nextCursor();
    if (!cursor || this.loading()) return;
    this.cursorStack.push(this.currentCursor);
    this.loadPage(cursor);
  }

  previousPage(): void {
    if (!this.cursorStack.length || this.loading()) return;
    const cursor = this.cursorStack.pop() ?? null;
    this.loadPage(cursor);
  }

  parentName(parentId: string | null): string {
    if (!parentId) return 'Danh mục gốc';
    const parent = this.parentOptions().find(item => item.id === parentId);
    return parent?.name ?? 'Danh mục cha khác';
  }

  isEligibleParent(item: AdminCategory): boolean {
    if (!this.editing) return true;
    if (item.id === this.editing.id) return false;
    // Avoid turning a category into the child of one of its descendants.
    const seen = new Set<string>();
    let id: string | null = item.parentId;
    while (id && !seen.has(id)) {
      if (id === this.editing.id) return false;
      seen.add(id);
      id = this.parentOptions().find(candidate => candidate.id === id)?.parentId ?? null;
    }
    return true;
  }

  openCreate(): void {
    this.editing = null;
    this.formName = '';
    this.formParentId = '';
    this.formStatus = 'ACTIVE';
    this.formError.set('');
    this.dialogOpen.set(true);
  }

  openEdit(item: AdminCategory): void {
    this.editing = item;
    this.formName = item.name;
    this.formParentId = item.parentId || '';
    this.formStatus = item.status;
    this.formError.set('');
    this.dialogOpen.set(true);
  }

  closeDialog(): void {
    if (this.saving()) return;
    this.dialogOpen.set(false);
    this.formError.set('');
  }

  saveCategory(): void {
    if (this.saving()) return;
    const name = this.formName.trim();
    if (name.length < 2 || name.length > 120) {
      this.formError.set('Tên danh mục phải có từ 2 đến 120 ký tự.');
      return;
    }
    if (this.formParentId && !this.parentOptions().some(
      item => item.id === this.formParentId && this.isEligibleParent(item),
    )) {
      this.formError.set('Danh mục cha không hợp lệ.');
      return;
    }

    const body: SaveCategoryRequest = {
      name,
      parentId: this.formParentId || null,
      status: this.formStatus,
    };
    this.saving.set(true);
    this.formError.set('');
    const action = this.editing
      ? this.categoryService.updateCategory(this.editing.id, body)
      : this.categoryService.createCategory(body);

    action.pipe(
      takeUntilDestroyed(this.destroyRef),
      finalize(() => this.saving.set(false)),
    ).subscribe({
      next: () => {
        const wasEdit = Boolean(this.editing);
        this.dialogOpen.set(false);
        this.notice.set(wasEdit ? 'Đã cập nhật danh mục thành công.' : 'Đã tạo danh mục thành công.');
        this.cursorStack = [];
        this.currentCursor = null;
        this.loadPage(null);
        this.loadParentOptions();
      },
      error: (err: unknown) => {
        this.formError.set(this.errorText(err, 'Không thể lưu danh mục.'));
      },
    });
  }

  private errorText(error: unknown, fallback: string): string {
    if (error instanceof Error && error.message) return error.message;
    return fallback;
  }
}
