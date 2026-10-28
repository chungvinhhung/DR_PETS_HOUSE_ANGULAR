import { Directive, effect, ElementRef, inject, input } from '@angular/core';

/** Các thuộc tính CSS nhận số KHÔNG cần đơn vị (danh sách giống React). */
const UNITLESS = new Set([
  'animationIterationCount', 'aspectRatio', 'borderImageOutset', 'borderImageSlice', 'borderImageWidth', 'boxFlex',
  'boxFlexGroup', 'boxOrdinalGroup', 'columnCount', 'columns', 'flex', 'flexGrow', 'flexPositive', 'flexShrink',
  'flexNegative', 'flexOrder', 'gridArea', 'gridRow', 'gridRowEnd', 'gridRowSpan', 'gridRowStart', 'gridColumn',
  'gridColumnEnd', 'gridColumnSpan', 'gridColumnStart', 'fontWeight', 'lineClamp', 'lineHeight', 'opacity', 'order',
  'orphans', 'scale', 'tabSize', 'widows', 'zIndex', 'zoom', 'fillOpacity', 'floodOpacity', 'stopOpacity',
  'strokeDasharray', 'strokeDashoffset', 'strokeMiterlimit', 'strokeOpacity', 'strokeWidth', 'WebkitLineClamp',
]);

function toCssName(key: string): string {
  if (key.startsWith('--')) return key;
  return key.replace(/^(Webkit|Moz|ms|O)(?=[A-Z])/, (m) => '-' + m.toLowerCase()).replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());
}

function toCssValue(key: string, value: unknown): string | null {
  if (value === null || value === undefined || value === '' || typeof value === 'boolean') return null;
  if (typeof value === 'number' && value !== 0 && !UNITLESS.has(key) && !key.startsWith('--')) return `${value}px`;
  return String(value);
}

/**
 * Gán style dạng object y như thuộc tính style={{...}} của React:
 *  - key viết camelCase (fontSize, WebkitMaskImage) hoặc kebab-case đều được
 *  - số tự thêm "px" (trừ các thuộc tính không đơn vị như opacity, zIndex, lineHeight...)
 *
 *   <div [appStyle]="{ left: pos.x, top: pos.y, transform: 'rotate(-36deg)' }">
 */
@Directive({ selector: '[appStyle]', standalone: true })
export class ReactStyleDirective {
  private readonly element = inject<ElementRef<HTMLElement | SVGElement>>(ElementRef);
  readonly appStyle = input<Record<string, unknown> | null | undefined>(null);
  private applied = new Set<string>();

  constructor() {
    effect(() => {
      const style = this.appStyle() ?? {};
      const next = new Set<string>();
      const target = this.element.nativeElement.style;
      for (const [key, raw] of Object.entries(style)) {
        const name = toCssName(key);
        const value = toCssValue(key, raw);
        if (value === null) continue;
        target.setProperty(name, value);
        next.add(name);
      }
      for (const name of this.applied) if (!next.has(name)) target.removeProperty(name);
      this.applied = next;
    });
  }
}
