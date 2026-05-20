export type WfhEnv = 'local' | 'dev' | 'stage' | 'iat' | 'uat' | 'prod';
export const WfhEnvs: WfhEnv[] = ['local', 'dev', 'stage', 'iat', 'uat', 'prod'];

interface SamlConfig {
  acs: string;
  acsCordovaWebAppDomain?: string; // actually called new-app by the EU team, the RN app is the replacement for the old web app
  audience: string;
  mockEligibility?: string;
  agApiKey?: string;
}

const acsPath = '/api/sso/saml/wfhMock';
const mockEligibilityPath = '/api/mock-eligibility';

const samlConfigMap: Record<WfhEnv, SamlConfig> = {
  local: {
    acs: 'http://127.0.0.1:3005' + acsPath,
    audience: 'com.wildflowerhealth.saml.dev',
    mockEligibility: 'http://127.0.0.1:3005' + mockEligibilityPath,
    agApiKey: process.env.AG_API_KEY ?? 'e020b2a6-30af-46f6-9524-c33dc0598461',
  },
  dev: {
    acs: 'https://anthem.dev.wildflowerhealth.digital' + acsPath,
    acsCordovaWebAppDomain: 'https://anthem-new-app.dev.wildflowerhealth.digital' + acsPath,
    audience: 'com.wildflowerhealth.saml.dev',
    mockEligibility: 'https://anthem.dev.wildflowerhealth.digital' + mockEligibilityPath,
    agApiKey: process.env.AG_API_KEY ?? 'e020b2a6-30af-46f6-9524-c33dc0598461',
  },
  stage: {
    acs: 'https://anthem.stage.wildflowerhealth.digital' + acsPath,
    acsCordovaWebAppDomain: 'https://anthem-new-app.stage.wildflowerhealth.digital' + acsPath,
    audience: 'com.wildflowerhealth.saml.staging',
    mockEligibility: 'https://anthem.stage.wildflowerhealth.digital' + mockEligibilityPath,
    agApiKey: process.env.AG_API_KEY ?? 'e020b2a6-30af-46f6-9524-c33dc0598461',
  },
  iat: {
    acs: 'https://anthem.iat.wildflowerhealth.digital' + acsPath,
    acsCordovaWebAppDomain: 'https://anthem-new-app.iat.wildflowerhealth.digital' + acsPath,
    audience: 'com.wildflowerhealth.saml.iat',
    mockEligibility: 'https://anthem.iat.wildflowerhealth.digital' + mockEligibilityPath,
    agApiKey: process.env.AG_API_KEY ?? 'e020b2a6-30af-46f6-9524-c33dc0598461',
  },
  uat: {
    acs: 'https://anthem-staging.buildinghealthyfamilies.ai' + acsPath,
    acsCordovaWebAppDomain: 'https://anthem-cordova.uat.wildflowerhealth.digital' + acsPath,
    audience: 'com.wildflowerhealth.saml.uat',
  },
  prod: {
    acs: 'https://anthem.buildinghealthyfamilies.ai' + acsPath,
    audience: 'com.wildflowerhealth.saml.production',
  },
};

export const getSamlConfig = (env: WfhEnv): SamlConfig => {
  return samlConfigMap[env];
};

// Parallel ACS for the new Elevance IdP (replaces SiteMinder-fronted Sydney).
// Posts land at app-gateway's /api/sso/saml/elevance slug (added in Phase 3 of
// SYS-17901) while the existing Sydney/wfhMock path keeps serving live users.
const elevanceAcsPath = '/api/sso/saml/elevance';

const elevanceSamlConfigMap: Record<WfhEnv, SamlConfig> = {
  local: {
    acs: 'http://127.0.0.1:3005' + elevanceAcsPath,
    audience: 'com.wildflowerhealth.saml.dev',
    mockEligibility: 'http://127.0.0.1:3005' + mockEligibilityPath,
    agApiKey: process.env.AG_API_KEY ?? 'e020b2a6-30af-46f6-9524-c33dc0598461',
  },
  dev: {
    acs: 'https://anthem.dev.wildflowerhealth.digital' + elevanceAcsPath,
    acsCordovaWebAppDomain: 'https://anthem-new-app.dev.wildflowerhealth.digital' + elevanceAcsPath,
    audience: 'com.wildflowerhealth.saml.dev',
    mockEligibility: 'https://anthem.dev.wildflowerhealth.digital' + mockEligibilityPath,
    agApiKey: process.env.AG_API_KEY ?? 'e020b2a6-30af-46f6-9524-c33dc0598461',
  },
  stage: {
    acs: 'https://anthem.stage.wildflowerhealth.digital' + elevanceAcsPath,
    acsCordovaWebAppDomain: 'https://anthem-new-app.stage.wildflowerhealth.digital' + elevanceAcsPath,
    audience: 'com.wildflowerhealth.saml.staging',
    mockEligibility: 'https://anthem.stage.wildflowerhealth.digital' + mockEligibilityPath,
    agApiKey: process.env.AG_API_KEY ?? 'e020b2a6-30af-46f6-9524-c33dc0598461',
  },
  iat: {
    acs: 'https://anthem.iat.wildflowerhealth.digital' + elevanceAcsPath,
    acsCordovaWebAppDomain: 'https://anthem-new-app.iat.wildflowerhealth.digital' + elevanceAcsPath,
    audience: 'com.wildflowerhealth.saml.iat',
    mockEligibility: 'https://anthem.iat.wildflowerhealth.digital' + mockEligibilityPath,
    agApiKey: process.env.AG_API_KEY ?? 'e020b2a6-30af-46f6-9524-c33dc0598461',
  },
  uat: {
    acs: 'https://anthem-staging.buildinghealthyfamilies.ai' + elevanceAcsPath,
    acsCordovaWebAppDomain: 'https://anthem-cordova.uat.wildflowerhealth.digital' + elevanceAcsPath,
    audience: 'com.wildflowerhealth.saml.uat',
  },
  prod: {
    acs: 'https://anthem.buildinghealthyfamilies.ai' + elevanceAcsPath,
    audience: 'com.wildflowerhealth.saml.production',
  },
};

export const getElevanceSamlConfig = (env: WfhEnv): SamlConfig => {
  return elevanceSamlConfigMap[env];
};
