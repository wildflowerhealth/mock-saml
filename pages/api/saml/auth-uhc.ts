import crypto from 'crypto';
import config from 'lib/env';
import type { NextApiRequest, NextApiResponse } from 'next';
import type { UhcUserAttributes } from 'types';
import { IdentityProvider, ServiceProvider, SamlLib, setSchemaValidator } from 'samlify';
import { randomId, renderAutoPostForm, samlifyAttrTag } from 'lib/samlify-post';
import { orderItemIdToSign } from 'lib/uhcOrders';
import {
  UHC_ATTRIBUTE_NAMES,
  UHC_ATTRIBUTE_NAME_FORMAT,
  UHC_IDP_ENTITY_ID,
  UHC_LEGACY_AUDIENCE,
  UHC_LEGACY_DESTINATION,
  UHC_NAMEID_FORMAT,
} from 'lib/uhc';

// samlify requires a schema validator at startup; passthrough is fine for a mock IdP.
setSchemaValidator({
  validate: () => Promise.resolve('valid'),
});

const POST_BINDING = 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST';

// samlify escapes every tag value it substitutes, so the AuthnStatement goes into the
// template itself and only its instant and session index are tag values.
const LOGIN_RESPONSE_TEMPLATE = SamlLib.defaultLoginResponseTemplate.context.replace(
  '{AuthnStatement}',
  '<saml:AuthnStatement AuthnInstant="{AuthnInstant}" SessionIndex="{SessionIndex}">' +
    '<saml:AuthnContext>' +
    '<saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef>' +
    '</saml:AuthnContext>' +
    '</saml:AuthnStatement>'
);

type UhcAuthRequestBody = Partial<UhcUserAttributes> & {
  acsUrl?: unknown;
  efid?: unknown;
  relayState?: unknown;
  signWithThrowawayKey?: unknown;
  /** SYS-20903: the mock UHC eligibility API answers this order inactive */
  orderInactive?: unknown;
};

// A key app-gateway has never seen. The response still declares the mock's certificate,
// so it passes the "certificate is in the metadata" check and fails on the signature
// itself: the refusal case in SYS-21234's done-when.
const throwawayPrivateKey = (): string =>
  crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  }).privateKey;

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).send(`Method ${req.method} Not Allowed`);
  }

  const body: UhcAuthRequestBody = req.body ?? {};
  const { acsUrl, efid, relayState } = body;
  if (typeof acsUrl !== 'string' || acsUrl === '' || typeof efid !== 'string' || efid === '') {
    return res.status(400).send('acsUrl and efid are required');
  }
  const signWithThrowawayKey = body.signWithThrowawayKey === true;
  // SYS-20903: an order UHC is to hold inactive carries the mark in its OrderItemID, the one
  // thing the mock eligibility API is asked about, so the mock remembers nothing
  const orderInactive = body.orderInactive === true;
  const attributeValue = (name: keyof UhcUserAttributes): unknown => {
    const value = body[name];
    return name === 'OrderItemID' && typeof value === 'string'
      ? orderItemIdToSign(value, orderInactive)
      : value;
  };

  // A blank field is left out of the assertion entirely, the way a missing attribute
  // arrives from Optum, so app-gateway's handling of each one can be exercised.
  const sentAttributes = UHC_ATTRIBUTE_NAMES.filter((name) => {
    const value = attributeValue(name);
    return typeof value === 'string' && value.trim() !== '';
  });

  // Optum's PingFederate, as its staging metadata describes it: signs, never encrypts,
  // NameID format unspecified.
  const idp = IdentityProvider({
    entityID: UHC_IDP_ENTITY_ID,
    privateKey: signWithThrowawayKey ? throwawayPrivateKey() : config.privateKey,
    signingCert: config.publicKey,
    isAssertionEncrypted: false,
    nameIDFormat: [UHC_NAMEID_FORMAT],
    singleSignOnService: [{ Binding: POST_BINDING, Location: `${config.appUrl}/saml/uhc` }],
    loginResponseTemplate: {
      context: LOGIN_RESPONSE_TEMPLATE,
      attributes: sentAttributes.map((name) => ({
        name,
        nameFormat: UHC_ATTRIBUTE_NAME_FORMAT,
        valueTag: name,
        valueXsiType: 'xs:string',
      })),
    },
  });

  // user-api's staging SP as registered with Optum. Wanting both the assertion and the
  // message signed makes samlify sign the Assertion, then the whole Response.
  const sp = ServiceProvider({
    entityID: UHC_LEGACY_AUDIENCE,
    wantAssertionsSigned: true,
    wantMessageSigned: true,
    isAssertionEncrypted: false,
    assertionConsumerService: [{ Binding: POST_BINDING, Location: UHC_LEGACY_DESTINATION, isDefault: true }],
  });

  const now = new Date();
  const fiveMinIso = new Date(now.getTime() + 5 * 60 * 1000).toISOString();
  const nowIso = now.toISOString();
  const responseId = `_${randomId()}`;

  // Destination, Recipient and Audience name user-api's legacy staging address however
  // the post is routed: that is what Optum's assertion says when it arrives through the
  // relay, and what app-gateway's provider checks.
  const tagValues: Record<string, string | undefined> = {
    ID: responseId,
    AssertionID: `_${randomId()}`,
    Destination: UHC_LEGACY_DESTINATION,
    Audience: UHC_LEGACY_AUDIENCE,
    SubjectRecipient: UHC_LEGACY_DESTINATION,
    Issuer: UHC_IDP_ENTITY_ID,
    IssueInstant: nowIso,
    StatusCode: 'urn:oasis:names:tc:SAML:2.0:status:Success',
    ConditionsNotBefore: nowIso,
    ConditionsNotOnOrAfter: fiveMinIso,
    SubjectConfirmationDataNotOnOrAfter: fiveMinIso,
    NameIDFormat: UHC_NAMEID_FORMAT,
    NameID: efid,
    // IdP-initiated: there is no AuthnRequest to answer. undefined makes samlify drop
    // the InResponseTo attributes instead of writing them empty.
    InResponseTo: undefined,
    AuthnInstant: nowIso,
    SessionIndex: `_${randomId()}`,
  };
  for (const name of sentAttributes) {
    const value = attributeValue(name);
    tagValues[samlifyAttrTag(name)] = typeof value === 'string' ? value : undefined;
  }

  const result = await idp.createLoginResponse(
    sp,
    { extract: {} },
    'post',
    {},
    {
      customTagReplacement: (template: string) => ({
        id: responseId,
        context: SamlLib.replaceTagsByValue(template, tagValues),
      }),
    }
  );

  console.log(
    `[mock-uhc] signed response for EFID ${efid} to ${acsUrl}: ${sentAttributes.length} of ${UHC_ATTRIBUTE_NAMES.length} attributes` +
      (signWithThrowawayKey ? ', throwaway key (expect refusal)' : '') +
      (orderInactive ? ', order held inactive' : '')
  );

  const html = renderAutoPostForm(
    acsUrl,
    result.context,
    typeof relayState === 'string' && relayState !== '' ? relayState : undefined
  );
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
}
