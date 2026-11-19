import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { ReactStyleDirective } from '../../../../../shared/customer/directives/react-style.directive';
import { medicalAssets } from '../../data/medical-treatment-data';

@Component({
  selector: 'section[app-medical-services]',
  standalone: true,
  imports: [ReactStyleDirective],
  templateUrl: './medical-services.component.html',
  styleUrl: './medical-services.component.scss',
  host: {
    'class': 'medical-services',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MedicalServicesComponent {
  readonly services = input<any>(undefined);

  protected readonly medicalAssets: any = medicalAssets;

  protected isCenteredLast(index: number, count: number): boolean {
    return index === count - 1 && count % 3 === 1;
  }
}
