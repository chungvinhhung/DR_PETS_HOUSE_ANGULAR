import { EnvironmentConfig } from './environment.model';

export const environment: EnvironmentConfig = {
  production: false,
  // Shared BE is the default for npm start / start:admin.
  // Use --configuration local-backend to work against localhost:8080.
  apiBaseUrl: 'https://pet-clinic-backend-a4lj.onrender.com/api/v1',
};
