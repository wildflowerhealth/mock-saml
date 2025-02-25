import { createHash } from 'crypto';
import config from 'lib/env';
import type { NextApiRequest, NextApiResponse } from 'next';
import type { SydneyUserAttributes } from 'types';
import saml from '@boxyhq/saml20';
import { getEntityId } from 'lib/entity-id';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { email, audience, acsUrl, id, relayState } = req.body;

    // if (
    //   !email.endsWith('@wfh-test.net') &&
    //   !email.endsWith('@example.com') &&
    //   !email.endsWith('@example.org')
    // ) {
    //   res.status(403).send(`${email} denied access`);
    // }

    const userId = createHash('sha256').update(email).digest('hex');
    const userName = email.split('@')[0];

    const sydneyUserAttributes: SydneyUserAttributes = {
        UserId: userId,
        ProxyID: '1234',
        userName: 'noah',
        userSurname: 'glusenkamp',
        userDateOfBirth: '10/05/1984',
        UserEmail: email,
        BrandId: 'my brand id',
        EmployerID: 'my employer id'
    };

    const xmlSigned = await saml.createSAMLResponse({
      issuer: getEntityId(config.entityId, req.query.namespace as any),
      audience,
      acsUrl,
      requestId: id,
      claims: {
        email: email,
        raw: sydneyUserAttributes
      },
      privateKey: config.privateKey,
      publicKey: config.publicKey,
    });
    console.log(xmlSigned);
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
