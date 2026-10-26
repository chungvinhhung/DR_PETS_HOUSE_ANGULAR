import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * FigmaMenuIcon — chuyển từ React: src/components/Navbar/MobileNavBar.jsx
 */
@Component({
  selector: 'app-figma-menu-icon',
  standalone: true,
  imports: [],
  templateUrl: './figma-menu-icon.component.html',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FigmaMenuIconComponent {
}
