import { ChangeDetectionStrategy, Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet],
  templateUrl: './app.component.html',
  styleUrl: './app.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AppComponent {
  readonly routeActivated = signal(false);

  onRouteActivated(component: unknown): void {
    // Customer CSS loads after the lazy Customer layout activates. Keep the
    // existing mascot loader visible until CSS is ready instead of showing
    // a second, competing loading screen.
    const stylesheetReady = (component as { whenStylesReady?: Promise<void> } | null)?.whenStylesReady;
    if (stylesheetReady && typeof stylesheetReady.then === 'function') {
      this.routeActivated.set(false);
      void stylesheetReady.then(() => this.routeActivated.set(true));
      return;
    }
    this.routeActivated.set(true);
  }
}
