import { HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { EMPTY, Observable, expand, map, reduce } from 'rxjs';

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

  /**
   * Proposed Admin create contract; NOT present in BE dev as of 2026-11-06.
   * Backend must supply the endpoint and enforce ADMIN authorization.
   */
  createCommunityPost(body:{
    title:string;content:string;type:string;imageUrls:string[];
    status:'DRAFT'|'APPROVED';
  }):Observable<any> {
    return this.api.post<any>('/admin/community/posts',body).pipe(map(unwrap));
  }

  /** Retrieve every BE page for the existing client-side 7-row Admin table.
   * Rescue/adoption routes expose page, limit and totalPages; unlike other
   * content types they cannot silently stop at the first 100 rows.
   */
  private listAllRescuePages(path:string):Observable<any[]> {
    const load=(page:number)=>this.api.get<any>(path,{
      params:new HttpParams().set('page',String(page)).set('limit','100'),
    }).pipe(map(response=>{
      const data=unwrap(response);
      const items=arrayFrom(data);
      const rawTotalPages=Number(data?.totalPages);
      const total=Number(data?.total);
      const totalPages=Number.isFinite(rawTotalPages)&&rawTotalPages>0
        ? rawTotalPages
        : Number.isFinite(total)&&total>0?Math.ceil(total/100):1;
      return {items,page,totalPages};
    }));
    return load(1).pipe(
      expand(result=>result.page<Math.min(100, result.totalPages)
        ? load(result.page+1)
        : EMPTY),
      reduce((rows,part)=>rows.concat(part.items),[] as any[]),
    );
  }

  listRescuePets():Observable<any[]> {
    return this.listAllRescuePages('/admin/rescue/pets');
  }

  listAdoptionRequests():Observable<any[]> {
    return this.listAllRescuePages('/admin/rescue/requests');
  }

  getPost(id:string):Observable<any> {
    return this.api.get<any>(`/admin/posts/${encodeURIComponent(id)}`).pipe(map(unwrap));
  }

  createPost(body:any):Observable<any> {
    return this.api.post<any>('/admin/posts',body).pipe(map(unwrap));
  }

  updatePost(id:string,body:any):Observable<any> {
    // foundation-v6 source uses PATCH for full content updates.
    return this.api.patch<any>(`/admin/posts/${encodeURIComponent(id)}`,body).pipe(map(unwrap));
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

  getRescuePet(id:string):Observable<any> {
    return this.api.get<any>(`/admin/rescue/pets/${encodeURIComponent(id)}`).pipe(map(unwrap));
  }

  createRescuePet(body:any):Observable<any> {
    return this.api.post<any>('/admin/rescue/pets',body).pipe(map(unwrap));
  }

  updateRescuePet(id:string,body:any):Observable<any> {
    return this.api.patch<any>(`/admin/rescue/pets/${encodeURIComponent(id)}`,body).pipe(map(unwrap));
  }

  deleteRescuePet(id:string):Observable<any> {
    return this.api.delete<any>(`/admin/rescue/pets/${encodeURIComponent(id)}`);
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
