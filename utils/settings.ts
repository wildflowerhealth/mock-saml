export type WfhEnv = 'local' | 'dev' | 'stage' | 'iat' | 'uat' | 'prod';
export declare const WfhEnvs: WfhEnv[];
export declare const wfhEnv: WfhEnv;

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
    acs: 'https://app-gateway.dev.wildflowerhealth.net' + acsPath,
    audience: 'com.wildflowerhealth.saml.dev',
  },
  stage: {
    acs: 'https://app-gateway.stage.wildflowerhealth.net' + acsPath,
    audience: 'com.wildflowerhealth.saml.staging',
  },
  iat: {
    acs: 'https://app-gateway.iat.wildflowerhealth.net' + acsPath,
    audience: 'com.wildflowerhealth.saml.iat',
  },
  uat: {
    acs: 'https://app-gateway.uat.wildflowerhealth.net' + acsPath,
    audience: 'com.wildflowerhealth.saml.uat',
  },
  prod: {
    acs: 'https://app-gateway.prod.wildflowerhealth.net' + acsPath,
    audience: 'com.wildflowerhealth.saml.production',
  },
};

export const getSamlConfig = (env: WfhEnv): SamlConfig => {
  return samlConfigMap[env];
};
