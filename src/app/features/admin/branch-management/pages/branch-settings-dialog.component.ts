import { ChangeDetectionStrategy, Component, EventEmitter, HostListener, Input, Output, signal } from '@angular/core';

export interface BranchSettingsPreview {
  id: string;
  name: string;
  address: string;
  hotline: string;
  status: 'ACTIVE' | 'INACTIVE';
}

/**
 * Branch editor: parent persists via PATCH /branches/:id and closes after success.
 * The dialog never reports success or closes before the API request completes.
 */
@Component({
  selector: 'app-branch-settings-dialog',
  standalone: true,
  template: `
    <div class="branch-settings__backdrop" (click)="close()" role="presentation">
      <section class="branch-settings__modal" role="dialog" aria-modal="true" aria-labelledby="branch-settings-title"
        (click)="$event.stopPropagation()">
        <header class="branch-settings__header">
          <div>
            <h2 id="branch-settings-title">{{ createMode ? 'Thêm chi nhánh' : 'Cấu hình chi nhánh' }}</h2>
          </div>
          <button type="button" aria-label="Đóng cấu hình chi nhánh" [disabled]="saving" (click)="close()">×</button>
        </header>
        <form (submit)="save($event)" class="branch-settings__form">
          <label>
            <span>Tên chi nhánh <b>*</b></span>
            <input #nameField type="text" maxlength="120" placeholder="Nhập tên chi nhánh" [value]="name()" (input)="name.set(nameField.value)" required />
          </label>
          <label>
            <span>Địa chỉ <b>*</b></span>
            <input #addressField type="text" maxlength="240" placeholder="Nhập địa chỉ chi nhánh" [value]="address()" (input)="address.set(addressField.value)" required />
          </label>
          <label>
            <span>Hotline</span>
            <input #phoneField type="tel" inputmode="tel" maxlength="20" [value]="hotline()" (input)="hotline.set(phoneField.value)" placeholder="Số liên hệ của chi nhánh"/>
          </label>
          <label>
            <span>Trạng thái chi nhánh</span>
            <select #statusField [value]="status()" [disabled]="!canChangeStatus"
              (change)="status.set(statusField.value === 'ACTIVE' ? 'ACTIVE' : 'INACTIVE')">
              <option value="ACTIVE">Đang hoạt động</option>
              <option value="INACTIVE">Ngừng hoạt động</option>
            </select>
          </label>
          @if (error()) { <p class="branch-settings__error" role="alert">{{ error() }}</p> }
          <footer class="branch-settings__footer">
            <button class="branch-settings__cancel" type="button" [disabled]="saving" (click)="close()">Hủy</button>
            <button class="branch-settings__save" type="submit" [disabled]="saving">{{ saving ? 'Đang lưu...' : (createMode ? 'Thêm chi nhánh' : 'Lưu cấu hình') }}</button>
          </footer>
        </form>
      </section>
    </div>
  `,
  styles: [`
    :host{font-family:Roboto,Arial,sans-serif;color:#1b273b}
    .branch-settings__backdrop{position:fixed;inset:0;z-index:1300;background:rgba(15,23,42,.55);display:flex;align-items:center;justify-content:center;padding:16px}
    .branch-settings__modal{width:min(100%,500px);max-height:calc(100dvh - 32px);overflow:auto;background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;box-shadow:0 18px 50px rgba(0,0,0,.18)}
    .branch-settings__header{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;padding-bottom:16px;border-bottom:1px solid #e2e8f0}
    .branch-settings__header h2{margin:0 0 5px;font-size:20px;font-weight:700}
    .branch-settings__header button{border:0;background:transparent;font-size:24px;color:#475569;cursor:pointer}
    .branch-settings__form{display:flex;flex-direction:column;gap:15px;padding-top:18px}
    .branch-settings__form label{display:flex;flex-direction:column;gap:7px;font-size:13px;color:#334155;font-weight:600}
    .branch-settings__form label b{color:#dc2626}
    .branch-settings__form :is(input,select){height:40px;width:100%;padding:0 11px;border:1px solid #e2e8f0;border-radius:8px;background:#fff;color:#1b273b;font:400 13px Roboto,Arial,sans-serif}
    .branch-settings__form select:disabled{background-color:#f1f5f9;color:#94a3b8;cursor:not-allowed}
    .branch-settings__form select {
      -webkit-appearance:none;
      appearance:none;
      padding:0 46px 0 12px;
      background:#fff url('/assets/admin-product/icon-chevron-down.svg') no-repeat right 16px center;
      background-size:16px 16px;
      cursor:pointer;
    }
    .branch-settings__form :is(input,select):focus-visible{outline:2px solid #0d47a1;outline-offset:1px}
    .branch-settings__error{font-size:12px;color:#b91c1c;background:#fff1f2;padding:10px;margin:0;border-radius:6px}
    .branch-settings__footer{display:flex;align-items:center;justify-content:flex-end;gap:10px;padding-top:12px;border-top:1px solid #e2e8f0}
    .branch-settings__footer button{height:40px;border-radius:8px;padding:0 14px;font:600 13px Roboto,Arial,sans-serif;cursor:pointer}
    .branch-settings__cancel{border:1px solid #e2e8f0;color:#0d47a1;background:#fff}
    .branch-settings__save{border:1px solid #0d47a1;color:#fff;background:#0d47a1}
  `],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BranchSettingsDialogComponent {
  @Input({ required: true }) set branch(value: BranchSettingsPreview) {
    this.id = value.id;
    this.name.set(value.name);
    this.address.set(value.address);
    this.hotline.set(value.hotline);
    this.status.set(value.status);
    this.error.set('');
  }
  @Input() saving = false;
  @Input() createMode = false;
  @Input() canChangeStatus = true;
  @Output() dismiss = new EventEmitter<void>();
  @Output() previewSaved = new EventEmitter<BranchSettingsPreview>();
  private id = '';
  readonly name = signal('');
  readonly address = signal('');
  readonly hotline = signal('');
  readonly status = signal<'ACTIVE' | 'INACTIVE'>('ACTIVE');
  readonly error = signal('');

  save(event: Event): void {
    event.preventDefault();
    const name = this.name().trim();
    const address = this.address().trim();
    const hotline = this.hotline().trim();
    if (!name || !address) {
      this.error.set('Vui lòng nhập tên và địa chỉ chi nhánh.');
      return;
    }
    if (hotline && !/^[+\d\s().-]{8,20}$/.test(hotline)) {
      this.error.set('Số điện thoại không đúng định dạng.');
      return;
    }
    this.previewSaved.emit({ id: this.id, name, address, hotline, status: this.status() });

  }
  close(): void { if (!this.saving) this.dismiss.emit(); }
  @HostListener('document:keydown.escape') onEscape(): void { this.close(); }
}
