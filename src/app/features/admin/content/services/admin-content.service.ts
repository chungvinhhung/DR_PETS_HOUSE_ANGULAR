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

  listArticles():Observable<any[]> {
    return this.api.get<any>('/posts').pipe(map(r=>arrayFrom(unwrap(r))));
  }
  listFirstAid():Observable<any[]> {
    return this.api.get<any>('/first-aid/guides').pipe(map(r=>arrayFrom(unwrap(r))));
  }
  listCommunity():Observable<any[]> {
    // foundation-v6 currently exposes only the legacy posts read model.
    return this.api.get<any>('/posts').pipe(map(r=>arrayFrom(unwrap(r))));
  }
  listRescuePets():Observable<any[]> {
    return this.api.get<any>('/adoptions/pets').pipe(map(r=>arrayFrom(unwrap(r))));
  }
  listAdoptionRequests():Observable<any[]> {
    return this.api.get<any>('/adoptions/my-requests').pipe(map(r=>arrayFrom(unwrap(r))));
  }
}
