import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { EMPTY, Observable, expand, map, reduce } from 'rxjs';

import { ApiClientService } from '../../../../core/services/api-client.service';

@Injectable({providedIn:'root'})
export class AdminModerationService{
 private readonly api=inject(ApiClientService);
 listReviews():Observable<any[]>{return this.api.get<any>('/reviews/admin',{params:new HttpParams().set('limit','100')}).pipe(map(r=>r?.items??[]));}
 hideReview(id:string,reason:string):Observable<any>{return this.api.post<any,{reason:string}>('/reviews/'+encodeURIComponent(id)+'/hide',{reason});}
 showReview(id:string):Observable<any>{return this.api.post<any,object>('/reviews/'+encodeURIComponent(id)+'/show',{});}
 listFeedback():Observable<any[]>{
  const fetchPage=(page:number)=>this.api.get<any>('/feedback',{
    params:new HttpParams().set('limit','100').set('page',String(page)),
  }).pipe(map(data=>({
    items:Array.isArray(data?.items)?data.items:[],
    page,totalPages:Number(data?.totalPages)||1,
  })));
  return fetchPage(1).pipe(
    expand(part=>part.page<Math.min(part.totalPages,100)?fetchPage(part.page+1):EMPTY),
    reduce((items,part)=>items.concat(part.items),[] as any[]),
  );
 }
 getFeedback(id:string):Observable<any>{return this.api.get<any>('/feedback/'+encodeURIComponent(id));}
 updateFeedback(id:string,status:string,notes?:string):Observable<any>{return this.api.patch<any,object>('/feedback/'+encodeURIComponent(id)+'/status',{status,notes});}
}
