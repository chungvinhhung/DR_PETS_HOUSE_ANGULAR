import { ChangeDetectionStrategy, Component, TemplateRef, input } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';

/**
 * UserProfileField — chuyển từ React: src/pages/User/UserProfilePage.jsx (component Field)
 */
@Component({
  selector: 'label[app-user-profile-field]',
  standalone: true,
  imports: [NgTemplateOutlet],
  templateUrl: './user-profile-field.component.html',
  styleUrl: './user-profile-field.component.scss',
  host: {
    'class': 'block min-w-0',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UserProfileFieldComponent {
  // --- Input / Output (props của React) ---
  readonly label = input<any>(undefined);
  readonly action = input<any>(undefined);

  // --- Dữ liệu & hàm dùng trong template ---
  /** true nếu giá trị là khối giao diện (<ng-template>) do component cha truyền vào */
  protected readonly isTemplateRef = (value: unknown): value is TemplateRef<unknown> => value instanceof TemplateRef;

}
