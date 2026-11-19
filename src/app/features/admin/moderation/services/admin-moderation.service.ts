import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { EMPTY, Observable, expand, map, reduce } from 'rxjs';

import { ApiClientService } from '../../../../core/services/api-client.service';

@Injectable({providedIn:'root'})
export class AdminModerationService{
 private readonly api=inject(ApiClientService);
 listReviews():Observable<any[]>{
  const fetchPage=(page:number)=>this.api.get<any>('/reviews/admin',{
    params:new HttpParams().set('limit','100').set('page',String(page)),
  }).pipe(map(data=>({
    items:Array.isArray(data?.items)?data.items:[],
    page,
    totalPages:Number(data?.totalPages)||1,
  })));
  return fetchPage(1).pipe(
    expand(part=>part.page<Math.min(part.totalPages,100)?fetchPage(part.page+1):EMPTY),
    reduce((items,part)=>items.concat(part.items),[] as any[]),
  );
 }
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
 listReports():Observable<any[]>{
  const fetchPage=(page:number)=>this.api.get<any>('/admin/reports',{
    params:new HttpParams().set('limit','100').set('page',String(page)),
  }).pipe(map(data=>{
    const resData=data?.data||data;
    const items=Array.isArray(resData?.items)?resData.items:Array.isArray(resData?.reports)?resData.reports:[];
    return {
      items,
      page,
      totalPages:Number(resData?.totalPages)||1,
    };
  }));
  return fetchPage(1).pipe(
    expand(part=>part.page<Math.min(part.totalPages,100)?fetchPage(part.page+1):EMPTY),
    reduce((items,part)=>items.concat(part.items),[] as any[]),
  );
 }
 getReport(id:string):Observable<any>{
  return this.api.get<any>('/admin/reports/'+encodeURIComponent(id)).pipe(
    map(data=>data?.data||data)
  );
 }
 resolveReport(id:string,decision:'HIDE_POST'|'NO_VIOLATION',moderationNote?:string):Observable<any>{
  return this.api.patch<any,object>('/admin/reports/'+encodeURIComponent(id)+'/resolve',{
    decision,
    moderationNote:moderationNote||''
  });
 }
}
