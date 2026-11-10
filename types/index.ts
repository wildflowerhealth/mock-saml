export type ServiceProvider = {
  acs_url: string;
  entity_id: string;
};

export type IdentityProvider = {
  ssoUrl: string;
  entityId: string;
};

export type App = {
  id: string;
  name: string;
  description?: string | null;
  certificate?: string | null;
} & ServiceProvider;

export type IdPMetadata = {
  certificate: string;
  fingerprint?: string;
} & IdentityProvider;

export type SAMLRequest = {
  entityID: string;
  callbackUrl: string;
  signingKey: string;
};

export type AuthNRequest = {
  relayState: string;
  samlRequest: string;
};

export type User = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
};

export type SydneyUserAttributes = {
  ProxyID: string;
  userName: string;
  userSurname: string;
  userDateOfBirth: string;
  UserEmail: string;
  UserId: string;
  BrandId: string;
  EmployerID: string;
  UnderWritingStateCd?: string;
  FundgTypeCd?: string;
};

// Mirrors SydneyUserAttributes until Elevance's Okta IdP confirms its
// outbound attribute names. Kept as a distinct type so the eventual
// divergence is a one-file change rather than a search-and-replace.
export type ElevanceUserAttributes = SydneyUserAttributes;

// Optum's eleven attributes for Every Mother's UHC sign-in, named exactly as Optum's
// staging IdP metadata (uhg.stage.myuhc) declares them. The member's EFID travels as
// the NameID, not as an attribute.
export type UhcUserAttributes = {
  VID: string;
  TransactionType: string;
  Email: string;
  SubscriptionStatus: string;
  FirstName: string;
  DOB: string;
  ProductID: string;
  LastName: string;
  ProgramType: string;
  UHC_Source_App: string;
  OrderItemID: string;
};
