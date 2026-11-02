import { Injectable, inject } from '@angular/core';
import { HttpParams } from '@angular/common/http';
import { Observable, map } from 'rxjs';

import { ApiClientService } from '../../../../core/services/api-client.service';

@Injectable({providedIn:'root'})
export class AdminModerationService{
 private readonly api=inject(ApiClientService);
 listReviews():Observable<any[]>{return this.api.get<any>('/reviews/admin',{params:new HttpParams().set('limit','100')}).pipe(map(r=>r?.items??[]));}
 hideReview(id:string,reason:string):Observable<any>{return this.api.post<any,{reason:string}>('/reviews/'+encodeURIComponent(id)+'/hide',{reason});}
 showReview(id:string):Observable<any>{return this.api.post<any,object>('/reviews/'+encodeURIComponent(id)+'/show',{});}
 listFeedback():Observable<any[]>{return this.api.get<any>('/feedback',{params:new HttpParams().set('limit','100')}).pipe(map(r=>r?.items??[]));}
 getFeedback(id:string):Observable<any>{return this.api.get<any>('/feedback/'+encodeURIComponent(id));}
 updateFeedback(id:string,status:string,notes?:string):Observable<any>{return this.api.patch<any,object>('/feedback/'+encodeURIComponent(id)+'/status',{status,notes});}
}
