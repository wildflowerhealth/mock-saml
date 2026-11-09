import type { NextApiRequest, NextApiResponse } from 'next';
import config from 'lib/env';
import { UHC_OPTUM_STAGING_SIGNING_CERT, buildUhcIdpMetadata } from 'lib/uhc';

// Optum's staging IdP metadata carrying this instance's signing certificate: the file
// app-gateway commits as config/data/saml/meta/<env>/uhcMetadata.xml on the environments
// that trust the mock UHC IdP. `?withOptumStaging` also lists UHG's real staging certificate
// (stage's file); `?download` serves it under that file name.
export default function handler(req: NextApiRequest, res: NextApiResponse<string>) {
  if (req.method !== 'GET') {
    return res.status(405).end(`Method ${req.method} Not Allowed`);
  }

  const certs =
    req.query.withOptumStaging !== undefined
      ? [UHC_OPTUM_STAGING_SIGNING_CERT, config.publicKey]
      : [config.publicKey];

  res.setHeader('Content-Type', 'text/xml');
  if (req.query.download !== undefined) {
    res.setHeader('Content-Disposition', 'attachment; filename=uhcMetadata.xml');
  }
  res.send(buildUhcIdpMetadata(certs));
}
