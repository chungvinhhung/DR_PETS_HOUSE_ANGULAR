import {
  AfterViewInit, ChangeDetectionStrategy, Component, ElementRef, EventEmitter,
  Input, Output, ViewChild,
} from '@angular/core';
import { SecurityContext } from '@angular/core';
import { DomSanitizer } from '@angular/platform-browser';

/** Small, dependency-free inline formatting editor used only by Content Studio.
 * The output is sanitized HTML plus plain text for backward compatibility.
 * The server must independently sanitize HTML before persisting or publishing.
 */
@Component({
  selector: 'app-admin-article-rich-block',
  standalone: true,
  template: `
    <div class="article-rich-shell">
    <div class="article-rich-toolbar" role="toolbar" aria-label="Định dạng văn bản"
      (mousedown)="keepSelection($event)">
      <button type="button" title="In đậm (Ctrl+B)" aria-label="In đậm"
        [disabled]="disabled" (click)="format('bold')"><strong>B</strong></button>
      <button type="button" title="In nghiêng (Ctrl+I)" aria-label="In nghiêng"
        [disabled]="disabled" (click)="format('italic')"><em>I</em></button>
      <button type="button" title="Gạch chân (Ctrl+U)" aria-label="Gạch chân"
        [disabled]="disabled" (click)="format('underline')"><u>U</u></button>
      <span class="article-rich-toolbar__separator" aria-hidden="true"></span>
      <button type="button" title="Gắn liên kết" aria-label="Gắn liên kết"
        [disabled]="disabled" (click)="openLinkEditor()">Liên kết</button>
      <button type="button" title="Danh sách đánh số" aria-label="Danh sách đánh số"
        [disabled]="disabled" (click)="format('insertOrderedList')">1. ≡</button>
      <span class="article-rich-toolbar__separator" aria-hidden="true"></span>
      <span class="article-rich-toolbar__color-label">Màu chữ:</span>
      @for (swatch of colors; track swatch.value) {
        <button type="button" class="article-rich-toolbar__swatch" [style.--swatch]="swatch.value"
          [title]="swatch.label" [attr.aria-label]="'Màu chữ: '+swatch.label"
          [disabled]="disabled" (click)="format('foreColor',swatch.value)">
          <span></span>
        </button>
      }
    </div>
    @if (linkEditorOpen) {
      <form class="article-rich-link-editor" (submit)="applyLink($event)"
        aria-label="Chèn liên kết ngay trong bài viết">
        <label>
          <span>Văn bản hiển thị</span>
          <input type="text" [value]="linkText" (input)="linkText= $any($event.target).value"
            placeholder="Tên liên kết" [disabled]="disabled">
        </label>
        <label>
          <span>Đường dẫn URL</span>
          <input type="url" [value]="linkUrl" (input)="linkUrl= $any($event.target).value"
            placeholder="https://..." [disabled]="disabled" required>
        </label>
        @if (linkError) { <p role="alert" class="article-rich-link-error">{{linkError}}</p> }
        <div class="article-rich-link-actions">
          <button type="button" (click)="closeLinkEditor()">Hủy</button>
          <button type="submit" [disabled]="disabled">Chèn link</button>
        </div>
      </form>
    }
    <div #editor class="article-rich-editable" role="textbox"
      [attr.aria-label]="type === 'list' ? 'Danh sách đánh số' : 'Nội dung '+type"
      [attr.aria-multiline]="true"
      [attr.data-placeholder]="type === 'list' ? 'Nhập mục đầu tiên, nhấn Enter để thêm mục tiếp theo...' : 'Nhập nội dung...'"
      [attr.contenteditable]="disabled ? 'false' : 'true'"
      (input)="emitValue()" (blur)="emitValue()" (paste)="pastePlainText($event)">
    </div>
    </div>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminArticleRichBlockComponent implements AfterViewInit {
  @Input({required:true}) type: 'paragraph'|'heading'|'list'|'quote' = 'paragraph';
  @Input() text = '';
  @Input() html = '';
  @Input() disabled = false;
  @Output() contentChange = new EventEmitter<{text:string;html:string}>();
  @ViewChild('editor',{static:true}) editor!: ElementRef<HTMLDivElement>;

  linkEditorOpen = false;
  linkText = '';
  linkUrl = '';
  linkError = '';
  private linkRange: Range | null = null;

  readonly colors = [
    {value:'#172B45',label:'Đen'},
    {value:'#0D47A1',label:'Xanh'},
    {value:'#D32F2F',label:'Đỏ'},
    {value:'#008060',label:'Xanh lá'},
  ];

  constructor(private readonly sanitizer:DomSanitizer) {}

  ngAfterViewInit():void {
    const host = this.editor.nativeElement;
    if (this.html?.trim()) {
      host.innerHTML = this.safeHtml(this.html);
    } else if (this.type === 'list') {
      const lines=this.text.split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
      const list=document.createElement('ol');
      for (const line of lines.length?lines:['']) {
        const li=document.createElement('li');
        li.textContent=line;
        if(!line) li.appendChild(document.createElement('br'));
        list.appendChild(li);
      }
      host.replaceChildren(list);
    } else {
      host.textContent=this.text;
    }
  }
  private safeHtml(html:string):string {
    return this.sanitizer.sanitize(SecurityContext.HTML,html) || '';
  }
  keepSelection(event:MouseEvent):void {
    if ((event.target as HTMLElement)?.closest('button')) event.preventDefault();
  }
  format(command:string,value?:string):void {
    if (this.disabled) return;
    const host=this.editor.nativeElement;
    const selection=window.getSelection();
    // When the cursor has never entered the editor, position it at the end.
    if (!selection?.rangeCount || !host.contains(selection.anchorNode)) {
      host.focus();
      const range=document.createRange();
      range.selectNodeContents(host);
      range.collapse(false);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    document.execCommand(command,false,value || undefined);
    host.focus();
    this.emitValue();
  }
  openLinkEditor():void {
    if(this.disabled) return;
    const host=this.editor.nativeElement;
    const selection=window.getSelection();
    const isInside=!!selection?.rangeCount && host.contains(selection.anchorNode);
    this.linkRange=isInside ? selection!.getRangeAt(0).cloneRange() : null;
    this.linkText=this.linkRange?.toString() || '';
    this.linkUrl='';
    this.linkError='';
    this.linkEditorOpen=true;
  }
  closeLinkEditor():void {
    this.linkEditorOpen=false;
    this.linkError='';
    this.linkRange=null;
  }
  applyLink(event:Event):void {
    event.preventDefault();
    if(this.disabled) return;
    let destination:URL;
    try {
      destination=new URL(this.linkUrl.trim());
      if(destination.protocol!=='https:' && destination.protocol!=='http:') throw new Error('invalid');
    } catch {
      this.linkError='Vui lòng nhập đường dẫn bắt đầu bằng https:// hoặc http://.';
      return;
    }
    const host=this.editor.nativeElement;
    host.focus();
    const selection=window.getSelection();
    let range=this.linkRange;
    if(!range || !host.contains(range.commonAncestorContainer)) {
      range=document.createRange();
      range.selectNodeContents(host);
      range.collapse(false);
    }
    selection?.removeAllRanges();
    selection?.addRange(range);
    const label=this.linkText.trim() || range.toString().trim() || destination.hostname;
    if(!range.collapsed && label===range.toString().trim()) {
      document.execCommand('createLink',false,destination.href);
    } else {
      const a=document.createElement('a');
      a.href=destination.href;
      a.textContent=label;
      a.target='_blank';
      a.rel='noopener noreferrer';
      range.deleteContents();
      range.insertNode(a);
      range.setStartAfter(a);
      range.collapse(true);
      selection?.removeAllRanges();
      selection?.addRange(range);
    }
    this.closeLinkEditor();
    this.emitValue();
  }
  pastePlainText(event:ClipboardEvent):void {
    if(this.disabled) return;
    event.preventDefault();
    const plain=event.clipboardData?.getData('text/plain') || '';
    document.execCommand('insertText',false,plain);
    this.emitValue();
  }
  emitValue():void {
    const host=this.editor.nativeElement;
    const html=this.safeHtml(host.innerHTML);
    const text=this.type === 'list'
      ? [...host.querySelectorAll('li')].map(x=>x.textContent?.trim()||'').filter(Boolean).join('\n')
        || host.innerText.replace(/\n{2,}/g,'\n').trim()
      : host.innerText.trim();
    this.contentChange.emit({html,text});
  }
}
