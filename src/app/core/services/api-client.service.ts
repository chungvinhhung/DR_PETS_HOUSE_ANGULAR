import {
  HttpClient,
  HttpHeaders,
  HttpParams,
} from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface ApiRequestOptions {
  headers?: HttpHeaders;
  params?: HttpParams;
  withCredentials?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class ApiClientService {
  private readonly http = inject(HttpClient);

  get<TResponse>(
    path: string,
    options: ApiRequestOptions = {},
  ): Observable<TResponse> {
    return this.http.get<TResponse>(this.buildUrl(path), options);
  }

  post<TResponse, TBody = unknown>(
    path: string,
    body: TBody,
    options: ApiRequestOptions = {},
  ): Observable<TResponse> {
    return this.http.post<TResponse>(this.buildUrl(path), body, options);
  }

  put<TResponse, TBody = unknown>(
    path: string,
    body: TBody,
    options: ApiRequestOptions = {},
  ): Observable<TResponse> {
    return this.http.put<TResponse>(this.buildUrl(path), body, options);
  }

  patch<TResponse, TBody = unknown>(
    path: string,
    body: TBody,
    options: ApiRequestOptions = {},
  ): Observable<TResponse> {
    return this.http.patch<TResponse>(this.buildUrl(path), body, options);
  }

  delete<TResponse>(
    path: string,
    options: ApiRequestOptions = {},
  ): Observable<TResponse> {
    return this.http.delete<TResponse>(this.buildUrl(path), options);
  }

  private buildUrl(path: string): string {
    const baseUrl = environment.apiBaseUrl.trim().replace(/\/+$/, '');

    if (!baseUrl) {
      throw new Error(
        'API base URL is not configured. Confirm the backend contract and set environment.apiBaseUrl before making API requests.',
      );
    }

    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    return `${baseUrl}${normalizedPath}`;
  }
}
