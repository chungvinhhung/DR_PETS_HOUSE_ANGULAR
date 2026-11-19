import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { SidebarHeadingComponent } from './sidebar-heading.component';
import { CategoryIconComponent } from '../../../../../shared/customer/components/blog-card/category-icon.component';
import { CustomerLinkDirective } from '../../../../../shared/customer/directives/customer-link.directive';
import { BLOG_CATEGORIES, QUICK_READ_POSTS } from '../../../../../shared/customer/data/blog-data';

/**
 * BlogSidebar — chuyển từ React: src/pages/Blog/BlogDetailPage.jsx
 */
@Component({
  selector: 'aside[app-blog-sidebar]',
  standalone: true,
  imports: [SidebarHeadingComponent, CategoryIconComponent, CustomerLinkDirective],
  templateUrl: './blog-sidebar.component.html',
  styleUrl: './blog-sidebar.component.scss',
  host: {
    'class': 'flex w-full shrink-0 flex-col lg:w-[330px] gap-6 self-start',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BlogSidebarComponent {
  // --- Input / Output (props của React) ---
  readonly selectedCategory = input<any>(undefined);

  // --- Dữ liệu & hàm dùng trong template ---
  protected readonly QUICK_READ_POSTS: any = QUICK_READ_POSTS;

  /** (tự sinh) function không dùng trực tiếp được trong template */
  protected list1(): any {
    return BLOG_CATEGORIES.filter((item: any) => item.id !== "all");
  }
}
