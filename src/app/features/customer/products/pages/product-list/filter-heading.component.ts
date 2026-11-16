import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * FilterHeading — chuyển từ React: src/pages/Product/ProductPage.jsx
 */
@Component({
  selector: 'div[app-filter-heading]',
  standalone: true,
  imports: [],
  templateUrl: './filter-heading.component.html',
  styleUrl: './filter-heading.component.scss',
  host: {
    'class': 'flex items-center gap-[17px]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FilterHeadingComponent {
}
