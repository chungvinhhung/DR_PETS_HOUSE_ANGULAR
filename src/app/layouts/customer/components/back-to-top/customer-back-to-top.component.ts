import { DOCUMENT } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { auditTime, fromEvent } from 'rxjs';

/**
 * Floating Customer-only back-to-top button.
 * Idle asset: backtotop.webp; scrolling-up asset: backtotop-active.webp.
 * Intentionally mounted in CustomerLayout, not the Admin shell.
 */
@Component({
  selector: 'app-customer-back-to-top',
  standalone: true,
  template: `
    @if (visible()) {
      <button
        type="button"
        class="customer-back-to-top"
        [class.customer-back-to-top--active]="active()"
        [attr.aria-label]="active() ? 'Đang cuộn lên đầu trang' : 'Lên đầu trang'"
        title="Lên đầu trang"
        (click)="scrollToTop()"
      >
        <img
          class="customer-back-to-top__image"
          [src]="active() ? '/assets/customer/back-to-top/backtotop-active.webp' : '/assets/customer/back-to-top/backtotop.webp'"
          alt=""
          aria-hidden="true"
          width="128"
          height="128"
          draggable="false"
        />
      </button>
    }
  `,
  styles: [`
    :host { display: contents; }
    .customer-back-to-top {
      position: fixed;
      right: max(18px, env(safe-area-inset-right, 0px));
      bottom: max(18px, env(safe-area-inset-bottom, 0px));
      z-index: 80;
      display: grid;
      place-items: center;
      width: 104px;
      height: 104px;
      padding: 0;
      border: 0;
      background: transparent;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      transition: transform 160ms ease;
    }
    .customer-back-to-top:hover { transform: translateY(-3px); }
    .customer-back-to-top:active { transform: scale(.96); }
    .customer-back-to-top:focus-visible { outline: 3px solid #005ab4; outline-offset: 2px; border-radius: 18px; }
    .customer-back-to-top__image {
      width: 100%;
      height: 100%;
      object-fit: contain;
      pointer-events: none;
      user-select: none;
      filter: drop-shadow(0 5px 8px rgba(10, 38, 70, .12));
    }
    .customer-back-to-top--active .customer-back-to-top__image { animation: customer-back-to-top-lift 720ms ease-in-out infinite alternate; }
    @keyframes customer-back-to-top-lift { from { transform: translateY(2px); } to { transform: translateY(-5px); } }
    @media(max-width: 767px) {
      .customer-back-to-top { width: 76px; height: 76px; right: max(10px, env(safe-area-inset-right, 0px)); bottom: max(14px, env(safe-area-inset-bottom, 0px)); }
    }
    @media(prefers-reduced-motion: reduce) {
      .customer-back-to-top, .customer-back-to-top--active .customer-back-to-top__image { animation: none; transition: none; }
    }
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CustomerBackToTopComponent {
  private readonly document = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);
  readonly visible = signal(false);
  readonly active = signal(false);
  private activeTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    const win = this.document.defaultView;
    if (!win) return;
    this.updatePosition();
    fromEvent(win, 'scroll', { passive: true }).pipe(
      auditTime(40),
      takeUntilDestroyed(this.destroyRef),
    ).subscribe(() => this.updatePosition());
    this.destroyRef.onDestroy(() => this.clearActiveTimeout());
  }

  private updatePosition(): void {
    const win = this.document.defaultView;
    if (!win) return;
    const position = win.scrollY || this.document.documentElement.scrollTop || this.document.body.scrollTop;
    this.visible.set(position > 420);
    if (position <= 2) {
      this.active.set(false);
      this.clearActiveTimeout();
    }
  }

  scrollToTop(): void {
    const win = this.document.defaultView;
    if (!win) return;
    this.active.set(true);
    this.clearActiveTimeout();
    const reduceMotion = win.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    win.scrollTo({ top: 0, left: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
    // Always return to idle, even if user interrupts the smooth scroll.
    this.activeTimeout = setTimeout(() => {
      this.active.set(false);
      this.updatePosition();
      this.activeTimeout = null;
    }, 1250);
  }

  private clearActiveTimeout(): void {
    if (this.activeTimeout !== null) {
      clearTimeout(this.activeTimeout);
      this.activeTimeout = null;
    }
  }
}
