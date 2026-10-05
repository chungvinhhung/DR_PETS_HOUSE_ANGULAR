import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';

import { ButtonComponent } from './shared/components/button/button.component';
import { LoadingComponent } from './shared/components/loading/loading.component';
import { PageTitleComponent } from './shared/components/page-title/page-title.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ButtonComponent, LoadingComponent, PageTitleComponent],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  readonly title = "Dr. Pet's House";
}
