import { Injectable, signal } from '@angular/core';

export type AdminSidebarGroup = 'sales' | 'services' | 'operations' | 'content' | 'feedback';

/**
 * A shared accordion state survives route changes between Admin pages.
 * Each page creates its own catalog shell, so component-local state would
 * be reset on every child-link click and re-trigger close/open animations.
 */
@Injectable({ providedIn: 'root' })
export class AdminSidebarAccordionService {
  readonly expandedGroup = signal<AdminSidebarGroup | null>(null);

  /** Open the ancestor for a newly visited route; do not reset an unchanged group. */
  openForRoute(group: AdminSidebarGroup | null): void {
    if (group !== null && this.expandedGroup() !== group) {
      this.expandedGroup.set(group);
    }
  }

  toggle(group: AdminSidebarGroup): void {
    this.expandedGroup.update(current => current === group ? null : group);
  }
}
