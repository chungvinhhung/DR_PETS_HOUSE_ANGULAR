import { ChangeDetectionStrategy, Component, input } from '@angular/core';

/**
 * CategoryBadge — chuyển từ React: src/components/blog/BlogCard.jsx
 */
@Component({
  selector: 'span[app-category-badge]',
  standalone: true,
  imports: [],
  templateUrl: './category-badge.component.html',
  styleUrl: './category-badge.component.scss',
  host: {
    'class': 'absolute left-3 top-3 flex items-center gap-1 rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.5px] text-[#0D47A1] shadow-sm backdrop-blur-[4px]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CategoryBadgeComponent {
  // --- Input / Output (props của React) ---
  readonly category = input<any>(undefined);
  readonly label = input<any>(undefined);
}
