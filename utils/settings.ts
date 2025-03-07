export type WfhEnv = 'local' | 'dev' | 'stage' | 'iat' | 'uat' | 'prod';
export const WfhEnvs: WfhEnv[] = ['local', 'dev', 'stage', 'iat', 'uat', 'prod'];

interface SamlConfig {
  acs: string;
  audience: string;
}

const acsPath = '/api/sso/saml/wfhMock';

const samlConfigMap: Record<WfhEnv, SamlConfig> = {
  local: {
    acs: 'http://127.0.0.1:3005' + acsPath,
    audience: 'com.wildflowerhealth.saml.dev',
  },
  dev: {
    acs: 'https://anthem.dev.wildflowerhealth.digital' + acsPath,
    audience: 'com.wildflowerhealth.saml.dev',
  },
  stage: {
    acs: 'https://anthem.stage.wildflowerhealth.digital' + acsPath,
    audience: 'com.wildflowerhealth.saml.staging',
  },
  iat: {
    acs: 'https://anthem.iat.wildflowerhealth.digital' + acsPath,
    audience: 'com.wildflowerhealth.saml.iat',
  },
  uat: {
    acs: 'https://anthem.uat.wildflowerhealth.digital' + acsPath,
    audience: 'com.wildflowerhealth.saml.uat',
  },
  prod: {
    acs: 'https://anthem.prod.wildflowerhealth.digital' + acsPath,
    audience: 'com.wildflowerhealth.saml.production',
  },
};

export const getSamlConfig = (env: WfhEnv): SamlConfig => {
  return samlConfigMap[env];
};
