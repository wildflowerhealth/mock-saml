import config from 'lib/env';
import type { NextApiRequest, NextApiResponse } from 'next';
import type { SydneyUserAttributes } from 'types';
import saml from '@boxyhq/saml20';
import { getEntityId } from 'lib/entity-id';
import { getSessionFromReq } from 'lib/session-api';

const isProdDestination = (acsUrl: string) => {
  return acsUrl === 'https://anthem.buildinghealthyfamilies.ai/api/sso/saml/wfhMock';
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).send(`Method ${req.method} Not Allowed`);
  }

  if (isProdDestination(req.body.acsUrl)) {
    const sess = getSessionFromReq(req);
    if (!sess) {
      // bounce to GitHub OAuth; after it completes, user returns here via "next"
      const referer = (req.headers.referer as string) || '/';
      const next = encodeURIComponent(referer);
      return res.status(401).json({
        ok: false,
        requiresAuth: true,
        signInUrl: `/api/gh/login?next=${next}`,
      });
    }
  }

  const {
    id,
    audience,
    acsUrl,
    relayState,
    email,
    firstName,
    lastName,
    dob,
    proxyId,
    brandId,
    employerId,
    stateCode,
    fundingType,
    hcid,
  } = req.body;

  const sydneyUserAttributes: SydneyUserAttributes = {
    UserId: hcid,
    ProxyID: proxyId,
    userName: firstName,
    userSurname: lastName,
    userDateOfBirth: dob,
    UserEmail: email,
    BrandId: brandId,
    EmployerID: employerId,
    UnderWritingStateCd: stateCode,
    FundgTypeCd: fundingType,
  };
  // console.log('Sydney User Attributes', sydneyUserAttributes);
  const xmlSigned = await saml.createSAMLResponse({
    issuer: getEntityId(config.entityId, req.query.namespace as any),
    audience,
    acsUrl,
    requestId: id,
    claims: {
      email: email,
      raw: sydneyUserAttributes,
    },
    privateKey: config.privateKey,
    publicKey: config.publicKey,
  });

  const encodedSamlResponse = Buffer.from(xmlSigned).toString('base64');
  const html = saml.createPostForm(acsUrl, [
    {
      name: 'RelayState',
      value: relayState,
    },
    {
      name: 'SAMLResponse',
      value: encodedSamlResponse,
    },
  ]);

  res.send(html);
}
