export interface EnvironmentConfig {
  production: boolean;
  apiBaseUrl: string;
  // Public OAuth client ID (not a client secret). Leave unset until configured.
  googleOAuthClientId?: string;
}
