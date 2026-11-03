import { HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, map } from 'rxjs';

import { ApiClientService } from '../../../../core/services/api-client.service';

function unwrap(response:any):any {
  if (response?.DT !== undefined) return response.DT;
  if (response?.data !== undefined) return response.data;
  return response;
}
function arrayFrom(payload:any):any[] {
  if (Array.isArray(payload)) return payload;
  return payload?.items ?? payload?.posts ?? payload?.guides ?? payload?.pets ?? payload?.applications ?? [];
}

@Injectable({providedIn:'root'})
export class AdminContentService {
  private readonly api=inject(ApiClientService);
  private readonly page100=new HttpParams().set('page','1').set('limit','100');

  listArticles():Observable<any[]> {
    return this.api.get<any>('/admin/posts', {
      params:this.page100.set('postType','OFFICIAL_BLOG'),
    }).pipe(map(r=>arrayFrom(unwrap(r))));
  }

  listFirstAid():Observable<any[]> {
    return this.api.get<any>('/admin/posts', {
      params:this.page100.set('postType','FIRST_AID'),
    }).pipe(map(r=>arrayFrom(unwrap(r))));
  }

  listCommunity():Observable<any[]> {
    return this.api.get<any>('/admin/community/posts', {
      params:this.page100,
    }).pipe(map(r=>arrayFrom(unwrap(r))));
  }

  listRescuePets():Observable<any[]> {
    return this.api.get<any>('/admin/rescue/pets', {
      params:this.page100,
    }).pipe(map(r=>arrayFrom(unwrap(r))));
  }

  listAdoptionRequests():Observable<any[]> {
    return this.api.get<any>('/admin/rescue/requests', {
      params:this.page100,
    }).pipe(map(r=>arrayFrom(unwrap(r))));
  }

  updatePostStatus(id:string,status:'DRAFT'|'PUBLISHED'|'ARCHIVED'):Observable<any> {
    return this.api.patch<any>(`/admin/posts/${encodeURIComponent(id)}/status`,{status})
      .pipe(map(unwrap));
  }

  deletePost(id:string):Observable<any> {
    return this.api.delete<any>(`/admin/posts/${encodeURIComponent(id)}`);
  }

  moderateCommunity(
    id:string,
    status:'APPROVED'|'REJECTED'|'HIDDEN',
    rejectionReason?:string,
  ):Observable<any> {
    return this.api.patch<any>(`/admin/community/posts/${encodeURIComponent(id)}/moderate`,{
      status,
      rejectionReason:rejectionReason?.trim()||undefined,
    }).pipe(map(unwrap));
  }

  deleteCommunity(id:string):Observable<any> {
    return this.api.delete<any>(`/admin/community/posts/${encodeURIComponent(id)}`);
  }

  reviewAdoptionRequest(
    id:string,
    status:'APPROVED'|'REJECTED',
    reviewNote?:string,
  ):Observable<any> {
    return this.api.patch<any>(`/admin/rescue/requests/${encodeURIComponent(id)}/review`,{
      status,
      reviewNote:reviewNote?.trim()||undefined,
    }).pipe(map(unwrap));
  }
}
