// Every Mother's UHC sign-in (SYS-21234, I4.1 of SYS-20903).
//
// UHC's identity provider (Optum's PingFederate) starts every sign-in itself: it posts an
// IdP-initiated, signed, unencrypted SAML response to user-api's registered assertion
// address. This mock produces the same message, so app-gateway's Every Mother provider can
// be built and proven before UHC gives us a staging test member.
//
// The mock is trusted on local, dev and stage only, through app-gateway's
// config/data/saml/meta/<NODE_ENV>/uhcMetadata.xml (WFH_ENV local → dev, dev → test,
// stage → staging):
//   meta/dev      the local mock's certificate (the repo's public.crt)
//   meta/test     the deployed mock's certificate (sso-saml.wfh-test.net)
//   meta/staging  the deployed mock's certificate and Optum's real staging one
// iat trusts Optum's real staging IdP alone; uat and prod never trust this mock.
import type { UhcUserAttributes } from 'types';

/** Optum's staging IdP entity id, as its federation metadata publishes it. */
export const UHC_IDP_ENTITY_ID = 'uhg.stage.myuhc';

// user-api's staging service-provider identity, as registered with Optum. app-gateway's
// Every Mother provider wears it on every environment below production and checks the
// assertion against it, so these stay fixed whatever address the form posts to.
export const UHC_LEGACY_AUDIENCE = 'https://user-api.staging.every-mother.com/v1/saml/metadata';
export const UHC_LEGACY_DESTINATION = 'https://user-api.staging.every-mother.com/v1/saml/acs';

export const UHC_NAMEID_FORMAT = 'urn:oasis:names:tc:SAML:1.1:nameid-format:unspecified';
export const UHC_ATTRIBUTE_NAME_FORMAT = 'urn:oasis:names:tc:SAML:2.0:attrname-format:basic';

/** Optum's eleven attributes, in the order its staging metadata lists them. */
export const UHC_ATTRIBUTE_NAMES: ReadonlyArray<keyof UhcUserAttributes> = [
  'VID',
  'TransactionType',
  'Email',
  'SubscriptionStatus',
  'FirstName',
  'DOB',
  'ProductID',
  'LastName',
  'ProgramType',
  'UHC_Source_App',
  'OrderItemID',
];

/**
 * UHG's staging signing certificate (CN UHGNonprod2024, valid to 1 June 2027), from Optum's
 * public federation metadata for uhg.stage.myuhc. Only used to build stage's metadata file,
 * which trusts the real IdP beside the mock.
 */
export const UHC_OPTUM_STAGING_SIGNING_CERT =
  'MIIDNjCCAh6gAwIBAgIGAYy2leVxMA0GCSqGSIb3DQEBCwUAMFwxCzAJBgNVBAYTAlVTMRIwEAYDVQQIEwlNaW5uZXNvdGExIDAeBgNVBAoTF1VuaXRlZEhlYWx0aCBHcm91cCBJbmMuMRcwFQYDVQQDEw5VSEdOb25wcm9kMjAyNDAeFw0yMzEyMjkxNzE4NDZaFw0yNzA2MDExNjE4NDZaMFwxCzAJBgNVBAYTAlVTMRIwEAYDVQQIEwlNaW5uZXNvdGExIDAeBgNVBAoTF1VuaXRlZEhlYWx0aCBHcm91cCBJbmMuMRcwFQYDVQQDEw5VSEdOb25wcm9kMjAyNDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAJQSw4SJjPcYe1NN7VKScMPWrr3vzNEhlR74uadcbA1a8m9pYR9gfJBvOBM4bo0gv8rHKmHq4bgtbpJSl5/AAVBUMqU/L8guC8xblAqmDuW7Spl+Fw+ob4Vuojyc+Agd/i2ONBV+bkoOZ483TD1P1XevoJtkAQ/tLoQsMi4YQ16+b6be2H3uwzYT0ToXmQK8yWkfQGuqdHDDe87eCbnRmH5ZD1pEKfVyNB8X8Ceo976Shnrx1e/N14ViJ6+HctkOLTAO9bsrlnG8NX+XfyJwe9SmyUif/OFbP3FSZPlrBdKINCIoqUDGAmeGw4L0btMS5p88GJOw08+41NZGW9ToRkMCAwEAATANBgkqhkiG9w0BAQsFAAOCAQEAM9zcEitsvoM2x9Qtf2vgEMguFWwAdIG6QlnpRjjtRIcw6UahocI4BY4YaJlcEZnM2otXj+pW5i49Ni/ne+GUKLc65g/dLOxDHqyvMgEhCVgUMEgw3+XCUqPWYOqgNEvjY4A5iXudcxBE0+03r3VO21km3KpYPhlTPRUB7ZJbxQK0hyjtlbHcO/eiBzMvEPuoYopsAasrugYe300yeTc1bR2LiZjyCTKYf0Y+C6wOZU9/PRJhGN1OTyZr8j2RclNpqISmOYyqoQg7C5eKwf+tf4CX9Sk1oqYvzSbWryHlGCi5EYnwYDxlYD0P9sWE0AXd7baTKqYvFjXvkp1VsEsPyA==';

const certBody = (pem: string): string =>
  pem.replace(/-----(BEGIN|END) CERTIFICATE-----/g, '').replace(/\s+/g, '');

const signingKeyDescriptor = (cert: string): string =>
  `<md:KeyDescriptor use="signing"><ds:KeyInfo xmlns:ds="http://www.w3.org/2000/09/xmldsig#"><ds:X509Data>` +
  `<ds:X509Certificate>${certBody(cert)}</ds:X509Certificate>` +
  `</ds:X509Data></ds:KeyInfo></md:KeyDescriptor>`;

/**
 * Optum's staging IdP metadata exactly as fetched on 9 November 2026 (partner id
 * uhg.stage.myuhc), with the given signing certificates (PEM or bare base64) in place of
 * UHG's. app-gateway's samlify accepts a response signed by any one of them, so stage's file
 * lists UHG's real certificate and the deployed mock's.
 */
export const buildUhcIdpMetadata = (signingCerts: string[]): string =>
  `<md:EntityDescriptor ID="MSXtBXqFk8qV-aO4h.Uer5aFQw5" cacheDuration="PT1440M" entityID="${UHC_IDP_ENTITY_ID}" xmlns:md="urn:oasis:names:tc:SAML:2.0:metadata">` +
  `<md:IDPSSODescriptor protocolSupportEnumeration="urn:oasis:names:tc:SAML:2.0:protocol" WantAuthnRequestsSigned="false">` +
  signingCerts.map(signingKeyDescriptor).join('') +
  `<md:NameIDFormat>${UHC_NAMEID_FORMAT}</md:NameIDFormat>` +
  UHC_ATTRIBUTE_NAMES.map(
    (name) =>
      `<saml:Attribute Name="${name}" NameFormat="${UHC_ATTRIBUTE_NAME_FORMAT}" xmlns:saml="urn:oasis:names:tc:SAML:2.0:assertion"/>`
  ).join('') +
  `</md:IDPSSODescriptor>` +
  `<md:ContactPerson contactType="administrative"><md:Company>UnitedHealth Group</md:Company></md:ContactPerson>` +
  `</md:EntityDescriptor>`;
