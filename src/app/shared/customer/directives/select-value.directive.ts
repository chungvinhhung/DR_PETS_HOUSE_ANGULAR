import { afterEveryRender, Directive, ElementRef, inject, input } from '@angular/core';

/**
 * Chọn giá trị cho <select> giống value={...} của React.
 *
 * Vì sao không dùng [value] trực tiếp? Angular gán [value] TRƯỚC khi các <option> (vẽ bằng @for)
 * được tạo ra, nên trình duyệt chọn sai option. Directive này gán lại sau mỗi lần render.
 *
 *   <select [selectValue]="branchId()" (change)="branchId.set($any($event).target.value)">
 */
@Directive({ selector: 'select[selectValue]', standalone: true })
export class SelectValueDirective {
  private readonly element = inject<ElementRef<HTMLSelectElement>>(ElementRef);
  readonly selectValue = input<unknown>(undefined);

  constructor() {
    afterEveryRender(() => {
      const value = this.selectValue();
      const next = value === null || value === undefined ? '' : String(value);
      if (this.element.nativeElement.value !== next) this.element.nativeElement.value = next;
    });
  }
}
