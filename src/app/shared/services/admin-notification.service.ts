import { computed, inject, Injectable, signal } from '@angular/core';
import { finalize } from 'rxjs';

import { ApiClientService } from '../../core/services/api-client.service';

export interface AdminNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
  metadata: Record<string, unknown>;
}
interface NotificationResponse {
  items?: unknown[];
  nextCursor?: string | null;
  total?: number;
}
const obj=(value:unknown):Record<string,unknown>|null=>
  value!==null && typeof value==='object' && !Array.isArray(value) ? value as Record<string,unknown> : null;
const text=(value:unknown):string=>typeof value==='string'?value:'';

@Injectable({providedIn:'root'})
export class AdminNotificationService {
  private readonly api=inject(ApiClientService);
  readonly items=signal<AdminNotification[]>([]);
  readonly loading=signal(false);
  readonly error=signal('');
  readonly loaded=signal(false);
  readonly unreadCount=computed(()=>this.items().filter(item=>!item.read).length);

  ensureLoaded(force=false):void {
    if(this.loading()||(!force&&this.loaded()))return;
    this.loading.set(true);this.error.set('');
    this.api.get<NotificationResponse>('/notifications?limit=20').pipe(
      finalize(()=>this.loading.set(false)),
    ).subscribe({
      next:response=>{
        const raw=Array.isArray(response?.items)?response.items:[];
        this.items.set(raw.map(item=>this.normalize(item)).filter((item):item is AdminNotification=>item!==null));
        this.loaded.set(true);
      },
      error:()=>{
        this.items.set([]);
        this.error.set('Không thể tải thông báo.');
        this.loaded.set(true);
      },
    });
  }

  markRead(id:string):void {
    const item=this.items().find(row=>row.id===id);
    if(!item||item.read)return;
    this.api.patch('/notifications/'+encodeURIComponent(id)+'/read',{}).subscribe({
      next:()=>this.items.update(rows=>rows.map(row=>row.id===id?{...row,read:true}:row)),
    });
  }

  markAllRead():void {
    if(!this.unreadCount())return;
    this.api.patch('/notifications/read-all',{}).subscribe({
      next:()=>this.items.update(rows=>rows.map(row=>({...row,read:true}))),
    });
  }

  private normalize(value:unknown):AdminNotification|null {
    const row=obj(value);if(!row)return null;
    const id=text(row['id'])||text(row['notification_id']);
    if(!id)return null;
    return {
      id,
      type:text(row['type'])||'SYSTEM',
      title:text(row['title'])||'Thông báo',
      body:text(row['body'])||text(row['content']),
      read:Boolean(row['read']??row['isRead']??row['is_read']),
      createdAt:text(row['createdAt'])||text(row['created_at']),
      metadata:obj(row['metadata'])??{},
    };
  }
}
