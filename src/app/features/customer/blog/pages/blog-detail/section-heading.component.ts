import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * SectionHeading — chuyển từ React: src/pages/Blog/BlogDetailPage.jsx
 */
@Component({
  selector: 'div[app-section-heading]',
  standalone: true,
  imports: [],
  templateUrl: './section-heading.component.html',
  styleUrl: './section-heading.component.scss',
  host: {
    'class': 'flex w-full items-center gap-4',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SectionHeadingComponent {
}
