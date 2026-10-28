import { inject, Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';

/**
 * Cho phép gán URL động vào <iframe [src]> (vd. bản đồ Google Maps).
 * Angular mặc định chặn URL động trong iframe để chống XSS; chỉ dùng pipe này với URL do chính dự án tạo ra.
 *
 *   <iframe [src]="mapUrl | trustResourceUrl"></iframe>
 */
@Pipe({ name: 'trustResourceUrl', standalone: true })
export class TrustResourceUrlPipe implements PipeTransform {
  private readonly sanitizer = inject(DomSanitizer);

  transform(url: string | null | undefined): SafeResourceUrl | null {
    return url ? this.sanitizer.bypassSecurityTrustResourceUrl(url) : null;
  }
}
