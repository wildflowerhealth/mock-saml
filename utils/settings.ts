export type WfhEnv = 'local' | 'dev' | 'stage' | 'iat' | 'uat' | 'prod';
export const WfhEnvs: WfhEnv[] = ['local', 'dev', 'stage', 'iat', 'uat', 'prod'];

interface SamlConfig {
  acs: string;
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
    audience: 'com.wildflowerhealth.saml.dev',
    mockEligibility: 'https://anthem.dev.wildflowerhealth.digital' + mockEligibilityPath,
    agApiKey: process.env.AG_API_KEY ?? 'e020b2a6-30af-46f6-9524-c33dc0598461',
  },
  stage: {
    acs: 'https://anthem.stage.wildflowerhealth.digital' + acsPath,
    audience: 'com.wildflowerhealth.saml.staging',
    mockEligibility: 'https://anthem.stage.wildflowerhealth.digital' + mockEligibilityPath,
    agApiKey: process.env.AG_API_KEY ?? 'e020b2a6-30af-46f6-9524-c33dc0598461',
  },
  iat: {
    acs: 'https://anthem.iat.wildflowerhealth.digital' + acsPath,
    audience: 'com.wildflowerhealth.saml.iat',
    mockEligibility: 'https://anthem.iat.wildflowerhealth.digital' + mockEligibilityPath,
    agApiKey: process.env.AG_API_KEY ?? 'e020b2a6-30af-46f6-9524-c33dc0598461',
  },
  uat: {
    acs: 'https://anthem-staging.buildinghealthyfamilies.ai' + acsPath,
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
