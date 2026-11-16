import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

@Component({
  selector: 'app-gender-icon',
  standalone: true,
  imports: [],
  templateUrl: './gender-icon.component.html',
  styleUrl: './gender-icon.component.scss',
  host: { style: 'display: contents' },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class GenderIconComponent {
  readonly gender = input<any>(undefined);
  readonly className = input<string>('');

  readonly isMale = computed<any>(() => this.gender() === 'Đực' || this.gender() === '♂');
  readonly isFemale = computed<any>(() => this.gender() === 'Cái' || this.gender() === '♀');
}
