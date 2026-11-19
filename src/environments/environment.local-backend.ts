import { EnvironmentConfig } from './environment.model';

/**
 * Opt-in for engineers running the BE server locally:
 * npm run start:admin:local-be
 */
export const environment: EnvironmentConfig = {
  production: false,
  apiBaseUrl: 'http://localhost:8080/api/v1',
};
