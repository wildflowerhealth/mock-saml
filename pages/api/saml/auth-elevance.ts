import fs from 'fs';
import path from 'path';
import config from 'lib/env';
import type { NextApiRequest, NextApiResponse } from 'next';
import type { ElevanceUserAttributes } from 'types';
import { IdentityProvider, ServiceProvider, SamlLib, setSchemaValidator } from 'samlify';
import { getEntityId } from 'lib/entity-id';
import { getSessionFromReq } from 'lib/session-api';

// samlify requires a schema validator at startup; passthrough is fine for a mock IdP.
setSchemaValidator({
  validate: () => Promise.resolve('valid'),
});

// Wildflower app-gateway SP public certificate — encrypts assertions to this cert
// so app-gateway's elevance route decrypts with its matching private key, exactly
// like the real Elevance Okta IdP will do post-cutover.
const spEncryptCert = fs.readFileSync(path.join(process.cwd(), 'lib', 'elevance-sp-cert.pem'));

const SAML_ATTRIBUTE_NAME_FORMAT = 'urn:oasis:names:tc:SAML:2.0:attrname-format:basic';
const ATTRIBUTE_TAGS: ReadonlyArray<keyof ElevanceUserAttributes> = [
  'userName',
  'userSurname',
  'userDateOfBirth',
  'UserEmail',
  'ProxyID',
  'UserId',
  'BrandId',
  'EmployerID',
  'UnderWritingStateCd',
  'FundgTypeCd',
];

const isProdDestination = (acsUrl: string) => {
  return acsUrl === 'https://anthem.buildinghealthyfamilies.ai/api/sso/saml/elevance';
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

  const elevanceUserAttributes: ElevanceUserAttributes = {
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

  const issuer = getEntityId(config.entityId, req.query.namespace as any);

  // mock-saml as IdP — sign-then-encrypt to mirror real Elevance Okta behavior.
  const idp = IdentityProvider({
    entityID: issuer,
    privateKey: config.privateKey,
    signingCert: config.publicKey,
    isAssertionEncrypted: true,
    messageSigningOrder: 'sign-then-encrypt',
    nameIDFormat: ['urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress'],
    singleSignOnService: [
      {
        Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
        Location: `${config.appUrl}/api/saml/sso`,
      },
    ],
    loginResponseTemplate: {
      context: SamlLib.defaultLoginResponseTemplate.context,
      attributes: ATTRIBUTE_TAGS.map((tag) => ({
        name: tag,
        nameFormat: SAML_ATTRIBUTE_NAME_FORMAT,
        valueTag: tag,
        valueXsiType: 'xs:string',
      })),
    },
  });

  // Wildflower app-gateway SP — what the IdP encrypts assertions for.
  const sp = ServiceProvider({
    entityID: audience,
    encryptCert: spEncryptCert,
    signingCert: spEncryptCert,
    wantAssertionsSigned: true,
    isAssertionEncrypted: true,
    assertionConsumerService: [
      {
        Binding: 'urn:oasis:names:tc:SAML:2.0:bindings:HTTP-POST',
        Location: acsUrl,
        isDefault: true,
      },
    ],
  });

  // customTagReplacement bypasses samlify's default tvalue fill — we own all
  // standard tags AND the {attr.<tag>} placeholders the attributes array emits.
  const now = new Date();
  const fiveMinLater = new Date(now.getTime() + 5 * 60 * 1000);
  const responseId = `_${randomId()}`;
  const assertionId = `_${randomId()}`;
  const sessionIndex = `_${randomId()}`;
  const nowIso = now.toISOString();
  const fiveMinIso = fiveMinLater.toISOString();

  const tagValues: Record<string, string> = {
    ID: responseId,
    AssertionID: assertionId,
    Destination: acsUrl,
    Audience: audience,
    EntityID: audience,
    SubjectRecipient: acsUrl,
    Issuer: issuer,
    IssueInstant: nowIso,
    AssertionConsumerServiceURL: acsUrl,
    StatusCode: 'urn:oasis:names:tc:SAML:2.0:status:Success',
    ConditionsNotBefore: nowIso,
    ConditionsNotOnOrAfter: fiveMinIso,
    SubjectConfirmationDataNotOnOrAfter: fiveMinIso,
    NameIDFormat: 'urn:oasis:names:tc:SAML:1.1:nameid-format:emailAddress',
    NameID: email,
    InResponseTo: '',
    AuthnStatement:
      `<saml:AuthnStatement AuthnInstant="${nowIso}" SessionIndex="${sessionIndex}">` +
      `<saml:AuthnContext>` +
      `<saml:AuthnContextClassRef>urn:oasis:names:tc:SAML:2.0:ac:classes:PasswordProtectedTransport</saml:AuthnContextClassRef>` +
      `</saml:AuthnContext>` +
      `</saml:AuthnStatement>`,
  };
  for (const tag of ATTRIBUTE_TAGS) {
    tagValues[samlifyAttrTag(tag)] = String(elevanceUserAttributes[tag] ?? '');
  }

  // IdP-initiated SAML — no inbound AuthnRequest. samlify's RequestInfo type
  // requires an extract field but tolerates an empty one (runtime path:
  // binding-post.js sets InResponseTo to '' when extract.request is missing).
  const result = await idp.createLoginResponse(
    sp,
    { extract: {} },
    'post',
    { email },
    {
      customTagReplacement: (template: string) => ({
        id: responseId,
        context: SamlLib.replaceTagsByValue(template, tagValues),
      }),
    }
  );

  const html = renderAutoPostForm(acsUrl, result.context, relayState || '');
  res.setHeader('Content-Type', 'text/html');
  res.send(html);
}

function randomId(): string {
  // 16 hex chars; matches SAML ID conventions without pulling in a UUID dep.
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

// Mirrors samlify's internal `tagging('attr', valueTag)` from libsaml.js. The
// loginResponseTemplate.attributes processor emits placeholders shaped by this
// rule (e.g. `ProxyID` → `{attrProxyId}`), so customTagReplacement keys must
// match exactly. Re-implementing locally because samlify doesn't export it.
function samlifyCamelCase(input: string): string {
  const words = input
    .replace(/([a-z\d])([A-Z])/g, '$1\0$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1\0$2')
    .split(/[\0\s\-_.]+/)
    .filter((w) => w.length > 0);
  return words
    .map((w, i) => {
      const lower = w.toLocaleLowerCase('en-US');
      return i === 0 ? lower : lower.charAt(0).toLocaleUpperCase('en-US') + lower.slice(1);
    })
    .join('');
}

function samlifyAttrTag(content: string): string {
  const camel = samlifyCamelCase(content);
  return 'attr' + camel.charAt(0).toUpperCase() + camel.slice(1);
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderAutoPostForm(action: string, samlResponseB64: string, relayState: string): string {
  return `<!DOCTYPE html>
<html><body>
  <form id="saml-form" method="POST" action="${escapeAttr(action)}">
    <input type="hidden" name="SAMLResponse" value="${escapeAttr(samlResponseB64)}" />
    <input type="hidden" name="RelayState" value="${escapeAttr(relayState)}" />
  </form>
  <script>document.getElementById('saml-form').submit();</script>
</body></html>`;
}
