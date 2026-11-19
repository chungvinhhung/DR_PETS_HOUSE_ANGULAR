import { EnvironmentConfig } from './environment.model';

export const environment: EnvironmentConfig = {
  production: false,
  // Default npm start / start:admin to the shared BE, so Customer and Admin
  // do not silently attempt an unstarted localhost:8080 service.
  // Explicit local-BE development remains available via --configuration local-backend.
  apiBaseUrl: 'https://pet-clinic-backend-a4lj.onrender.com/api/v1',
};
