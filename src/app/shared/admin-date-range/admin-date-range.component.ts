import { CommonModule } from '@angular/common';
import { ChangeDetectionStrategy, Component, HostListener, computed, input, output, signal } from '@angular/core';

export interface AdminDateRange {
  from: string;
  to: string;
}

function localDay(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0')].join('-');
}

/** The same two-click inclusive calendar interaction as Order → Trả hàng & hoàn tiền. */
@Component({
  selector: 'app-admin-date-range',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './admin-date-range.component.html',
  styleUrl: './admin-date-range.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDateRangeComponent {
  readonly from = input('');
  readonly to = input('');
  readonly rangeChange = output<AdminDateRange>();

  readonly open = signal(false);
  readonly draftStart = signal<string | null>(null);
  readonly month = signal(localDay(new Date()).slice(0, 7));
  readonly weekdays = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];
  readonly label = computed(() => {
    const [year, month] = this.month().split('-').map(Number);
    return `Tháng ${month}/${year}`;
  });
  readonly days = computed(() => {
    const [year, month] = this.month().split('-').map(Number);
    const first = new Date(year, month - 1, 1);
    const offset = (first.getDay() + 6) % 7;
    const count = Math.ceil((offset + new Date(year, month, 0).getDate()) / 7) * 7;
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(year, month - 1, i + 1 - offset);
      return {
        key: localDay(d),
        number: d.getDate(),
        currentMonth: d.getMonth() === month - 1,
      };
    });
  });

  formatDay(value: string): string {
    const parts = value.split('-');
    return parts.length === 3 ? [parts[2], parts[1], parts[0]].join('/') : value;
  }

  toggle(): void {
    if (this.open()) { this.close(); return; }
    this.month.set((this.to() || this.from() || localDay(new Date())).slice(0, 7));
    this.draftStart.set(null);
    this.open.set(true);
  }
  close(): void {
    this.open.set(false);
    this.draftStart.set(null);
  }
  changeMonth(amount: number): void {
    const [year, month] = this.month().split('-').map(Number);
    this.month.set(localDay(new Date(year, month - 1 + amount, 1)).slice(0, 7));
  }
  selectDay(value: string): void {
    const start = this.draftStart();
    if (!start) {
      // First click only stages the start. Keep the active filter unchanged.
      this.draftStart.set(value);
      return;
    }
    // Second click commits an inclusive range; reverse selection is allowed.
    this.rangeChange.emit({
      from: start <= value ? start : value,
      to: start <= value ? value : start,
    });
    this.close();
  }
  clear(): void {
    this.rangeChange.emit({ from: '', to: '' });
    this.close();
  }
  isStart(value: string): boolean { return value === (this.draftStart() || this.from()); }
  isEnd(value: string): boolean { return !this.draftStart() && value === this.to(); }
  isBetween(value: string): boolean {
    return !this.draftStart() && Boolean(this.from() && this.to())
      && value > this.from() && value < this.to();
  }

  @HostListener('document:click', ['$event'])
  onOutside(event: MouseEvent): void {
    if (this.open() && event.target instanceof Node
      && !this.hostContains(event.target)) this.close();
  }

  private hostContains(node: Node): boolean {
    return Boolean((node as Element).parentElement?.closest('app-admin-date-range')
      || (node as Element).closest?.('app-admin-date-range'));
  }

  @HostListener('document:keydown.escape')
  onEscape(): void { if (this.open()) this.close(); }
}
