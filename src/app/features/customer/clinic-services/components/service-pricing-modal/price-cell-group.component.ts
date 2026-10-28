import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * PriceCellGroup — chuyển từ React: src/components/groomingSpa/ServicePricingModal.jsx
 */
@Component({
  selector: 'div[app-price-cell-group]',
  standalone: true,
  imports: [],
  templateUrl: './price-cell-group.component.html',
  host: {
    'class': 'flex shrink-0 items-center gap-2',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PriceCellGroupComponent {
}
