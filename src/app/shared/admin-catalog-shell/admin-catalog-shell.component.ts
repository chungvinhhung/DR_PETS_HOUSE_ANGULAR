import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Shared Admin catalog chrome for Category and Product screens.
 * Render the header/sidebar once here so switching routes keeps pixel-identical
 * dimensions, image rendering and navigation placement.
 */
@Component({
  selector: 'app-admin-catalog-shell',
  standalone: true,
  imports: [RouterLink],
  templateUrl: './admin-catalog-shell.component.html',
  styleUrl: './admin-catalog-shell.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminCatalogShellComponent {
  @Input({ required: true }) activeItem!: 'categories' | 'products' | 'services';

  salesExpanded = false;
  servicesExpanded = false;

  ngOnInit(): void {
    this.salesExpanded = this.activeItem === 'categories' || this.activeItem === 'products';
    this.servicesExpanded = this.activeItem === 'services';
  }

  toggleSales(): void {
    this.salesExpanded = !this.salesExpanded;
  }

  toggleServices(): void {
    this.servicesExpanded = !this.servicesExpanded;
  }
}
