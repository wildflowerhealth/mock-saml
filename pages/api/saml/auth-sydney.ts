import { createHash, randomInt } from 'crypto';
import config from 'lib/env';
import type { NextApiRequest, NextApiResponse } from 'next';
import type { SydneyUserAttributes } from 'types';
import saml from '@boxyhq/saml20';
import { getEntityId } from 'lib/entity-id';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
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
      code: stateCode,
      fundgTypeCd: fundingType,
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
  } else {
    res.status(405).send(`Method ${req.method} Not Allowed`);
  }
}
