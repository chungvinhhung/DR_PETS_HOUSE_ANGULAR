import { ChangeDetectionStrategy, Component } from '@angular/core';

/**
 * RequiredMark — chuyển từ React: src/components/rescue/AdoptionApplicationModal.jsx
 */
@Component({
  selector: 'span[app-required-mark]',
  standalone: true,
  imports: [],
  templateUrl: './required-mark.component.html',
  host: {
    'class': 'text-[#C62828]',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class RequiredMarkComponent {
}
