import { Injectable, inject } from '@angular/core';
import { CustomerHttpService, assertSuccess } from '../customer-http.service';

export interface LocationItem {
  code: string;
  name: string;
  slug?: string;
  type?: string;
  provinceCode?: string;
  districtCode?: string;
}

@Injectable({
  providedIn: 'root',
})
export class LocationApiService {
  private readonly http = inject(CustomerHttpService);

  async getProvinces(q: string = ''): Promise<LocationItem[]> {
    try {
      const response: any = await this.http.get('/locations/provinces', {
        params: q ? { q } : undefined,
      });
      const data = assertSuccess(response);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  async getDistricts(province: string, q: string = ''): Promise<LocationItem[]> {
    try {
      const response: any = await this.http.get('/locations/districts', {
        params: { province, ...(q ? { q } : {}) },
      });
      const data = assertSuccess(response);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }

  async getWards(district: string, province: string = '', q: string = ''): Promise<LocationItem[]> {
    try {
      const response: any = await this.http.get('/locations/wards', {
        params: { district, ...(province ? { province } : {}), ...(q ? { q } : {}) },
      });
      const data = assertSuccess(response);
      return Array.isArray(data) ? data : [];
    } catch {
      return [];
    }
  }
}
