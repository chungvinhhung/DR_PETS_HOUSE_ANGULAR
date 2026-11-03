import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

export interface AdminBreadcrumbItem {
  label: string;
  link?: string | readonly any[];
}

@Component({
  selector: 'app-admin-breadcrumb',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './admin-breadcrumb.component.html',
  styleUrl: './admin-breadcrumb.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminBreadcrumbComponent {
  @Input({ required: true }) items: readonly AdminBreadcrumbItem[] = [];
}
