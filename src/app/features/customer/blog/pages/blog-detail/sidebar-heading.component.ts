import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * SidebarHeading — chuyển từ React: src/pages/Blog/BlogDetailPage.jsx
 */
@Component({
  selector: 'div[app-sidebar-heading]',
  standalone: true,
  imports: [],
  templateUrl: './sidebar-heading.component.html',
  styleUrl: './sidebar-heading.component.scss',
  host: {
    'class': 'flex w-full items-center gap-2',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SidebarHeadingComponent {
}
