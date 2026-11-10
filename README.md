# Mock SSO

Mock identity provider service for testing SSO integrations. Supports SAML 2.0 (Sydney/Anthem, Elevance, and UHC for Every Mother) and OAuth2/OIDC (Cigna Auth0).

Forked from [BoxyHQ/mock-saml](https://github.com/boxyhq/mock-saml).

## Mock Providers

| Provider     | Type        | Page                     | Description                                                                                                                    |
| ------------ | ----------- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Sydney SSO   | SAML 2.0    | `/saml/sydney`           | Anthem/Sydney SAML IdP with configurable user attributes and mock eligibility                                                  |
| Elevance SSO | SAML 2.0    | `/saml/elevance`         | Anthem/Elevance Okta SAML IdP (parallel to Sydney; targets `/api/sso/saml/elevance` ACS)                                       |
| UHC SSO      | SAML 2.0    | `/saml/uhc`              | Optum's IdP for Every Mother's UHC sign-in. Local, dev and stage only; iat uses Optum's staging IdP (see [UHC](#uhc-sso-mock)) |
| Cigna Auth0  | OAuth2/OIDC | `/cigna-auth0/authorize` | Mock Cigna Auth0 with test users, token exchange, and mock API endpoints                                                       |

## Quick Start

```bash
npm install
npm run serve    # Build and start on port 4123
```

Open http://localhost:4123 to see all providers.

## UHC SSO Mock

UHC members reach Every Mother only by clicking through from the UHC Store: Optum's IdP (`uhg.stage.myuhc` on staging) posts an IdP-initiated SAML response to user-api's registered assertion address. `/saml/uhc` produces the same message so app-gateway's Every Mother provider (SYS-20903) can be built and tested before UHC provides a staging test member (SYS-21234).

What it posts:

- A signed, unencrypted response: the Response and the Assertion are both signed with this instance's key pair.
- Issuer `uhg.stage.myuhc`; NameID format unspecified, carrying the member's EFID; Optum's eleven attributes (`VID`, `TransactionType`, `Email`, `SubscriptionStatus`, `FirstName`, `DOB`, `ProductID`, `LastName`, `ProgramType`, `UHC_Source_App`, `OrderItemID`).
- `Audience` fixed to `https://user-api.staging.every-mother.com/v1/saml/metadata`, and `Destination` and `Recipient` fixed to `https://user-api.staging.every-mother.com/v1/saml/acs`, whatever address the form posts to. Those are the values Optum's assertion carries through the relay, and app-gateway checks them.
- No `InResponseTo` (there is no AuthnRequest), and no `RelayState` unless the page was opened with `?relayState=`.
- A blank attribute field is left out of the assertion, so app-gateway's 422 path can be exercised. "Sign with a throwaway key" signs with a fresh key while still declaring this instance's certificate; app-gateway must refuse it.

Defaults: `ProductID=202642_Annual` (user-api's staging plan), `TransactionType=New`, `SubscriptionStatus=Active`, UUID `OrderItemID` and `VID`. `DOB`, `ProgramType` and `UHC_Source_App` are placeholders (no Optum sample observed; user-api ignores them).

### Outcome presets

The presets differ only in the EFID and email sent. The first, second and fourth need matching records in the target environment.

| Preset                         | EFID / email                                              | Needs in the target environment                                              | app-gateway answers                                    |
| ------------------------------ | --------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------ |
| Linked member in good standing | `MOCKUHC-LINKED` / `uhc-mock+linked@wildflowerhealth.com` | An account linked to that EFID with an active UHC subscription               | 303 with `token`                                       |
| Account to link                | fresh / `uhc-mock+link@wildflowerhealth.com`              | An account with that email, no UHC link, no active subscription              | 303 with `pending_link_id`                             |
| New member                     | fresh / fresh                                             | Nothing                                                                      | 303 with `pending_saml_id` and `is_new_user=1`         |
| Member paying elsewhere        | fresh / `uhc-mock+other-platform@wildflowerhealth.com`    | An account with that email and an active app-store or Chargebee subscription | 303 with `error=active_membership_with_other_platform` |

### Where the mock is trusted

Only local, dev and stage trust this mock. app-gateway reads `config/data/saml/meta/<NODE_ENV>/uhcMetadata.xml`, and `WFH_ENV` maps local → `dev`, dev → `test`, stage → `staging`:

| WFH_ENV   | app-gateway file            | Signing certificates                                       | Use                                                             |
| --------- | --------------------------- | ---------------------------------------------------------- | --------------------------------------------------------------- |
| local     | `meta/dev/uhcMetadata.xml`  | this repo's `public.crt` (the local mock)                  | a local mock-saml posting to a local app-gateway                |
| dev       | `meta/test/...`             | the deployed mock (`sso-saml.wfh-test.net`)                | the deployed `/saml/uhc` posting to dev's app-gateway           |
| stage     | `meta/staging/...`          | the deployed mock, and UHG's real staging cert             | the deployed `/saml/uhc`, or a real `stage-sso.optum.com` login |
| iat       | `meta/iat/...`              | UHG's real staging cert only                               | Optum's staging IdP                                             |
| uat, prod | `meta/{uat,production}/...` | UHG's real certs only (staging on uat, production on prod) | Optum's IdP; never the mock                                     |

Each file is Optum's staging metadata with the certificates swapped. Generate it from the instance whose key should be trusted: `GET /api/saml/metadata-uhc?download` (local from `localhost:4123`, dev from `sso-saml.wfh-test.net`), adding `&withOptumStaging` for stage's file.

### Mock UHC eligibility API

Before activation, the member site asks whether UHC holds the member's order active. As user-api did, Wildflower reads its ledger first and then asks UHC's eligibility API (SYS-20903). UHC's real API knows nothing of the mock's members, so the mock serves one in UHC's shape:

| Endpoint                              | Answers                                                                                                                                                         |
| ------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `POST /api/uhc/oauth/token`           | A client-credentials token, to any client                                                                                                                       |
| `POST /api/uhc/hub/1.0.0/eligibility` | `IS_ACTIVE: true` for an order (EFID and `OrderItemID`) the UHC page signed in the last 48 hours, unless it was launched with **UHC holds this order inactive** |

Point portal-facade at it with its `EM_UHC_API_*` settings, for example locally in the monorepo's root `.env`:

```
EM_UHC_API_URL=http://localhost:4123/api/uhc
EM_UHC_API_TOKEN_URL=http://localhost:4123/api/uhc/oauth/token
EM_UHC_API_CLIENT_ID=mock-saml
EM_UHC_API_CLIENT_SECRET=mock-saml-local
EM_UHC_ELIGIBILITY_SCOPE=eligibility
EM_UHC_UPSTREAM_ENV=local
```

The signed orders are held in memory, so a restart forgets them: launch the sign-in again.

## Scripts

| Command                | Description                                                       |
| ---------------------- | ----------------------------------------------------------------- |
| `npm run serve`        | Build and start the production server (recommended for local use) |
| `npm run dev`          | Start dev server with hot reload (clears `.next` cache first)     |
| `npm run build`        | Build for production                                              |
| `npm start`            | Start production server (requires `npm run build` first)          |
| `npm run lint`         | Run ESLint                                                        |
| `npm run format`       | Format with Prettier                                              |
| `npm run check-format` | Check formatting                                                  |

## Cigna Auth0 Mock

### Endpoints

| Path                                                    | Method | Description                                        |
| ------------------------------------------------------- | ------ | -------------------------------------------------- |
| `/cigna-auth0/authorize`                                | GET    | Login page with test user selection                |
| `/api/cigna-auth0/authorize/callback`                   | POST   | Validates credentials, generates auth code         |
| `/api/cigna-auth0/oauth/token`                          | POST   | Token exchange (authorization_code, refresh_token) |
| `/api/cigna-auth0/rtde/v1/userinfo`                     | GET    | User profile (requires Bearer token)               |
| `/api/cigna-auth0/rtde/v1/biometrics`                   | GET    | Biometric data (requires Bearer token)             |
| `/api/cigna-auth0/rtde/v1/surveyresponses`              | POST   | Create survey response (requires Bearer token)     |
| `/api/cigna-auth0/rtde/v1/surveyresponses/:id/complete` | GET    | Complete survey (requires Bearer token)            |
| `/api/cigna-auth0/rtde/v3/incentives`                   | GET    | Incentives/rewards (requires Bearer token)         |
| `/api/cigna-auth0/well-known/openid-configuration`      | GET    | OIDC discovery document                            |

### URL Rewrites (local dev)

These Next.js rewrites allow the app-gateway to call standard OAuth/API paths directly on `localhost:4123` without a path prefix:

- `/oauth/token` → `/api/cigna-auth0/oauth/token`
- `/rtde/*` → `/api/cigna-auth0/rtde/*`
- `/.well-known/openid-configuration` → `/api/cigna-auth0/well-known/openid-configuration`

### Test Users

| Username     | Password     | Employer | Products                   |
| ------------ | ------------ | -------- | -------------------------- |
| JoePlayer    | nflmycigna1  | Cigna    | None                       |
| testfujifilm | Fujifilm1    | Fujifilm | Healthy Pregnancies/Babies |
| Holt25       | Titans35     | MNPS     | Healthy Pregnancies/Babies |
| Testcitizens | Citizens2015 | Citizens | Healthy Pregnancies/Babies |

### Logging

All Cigna Auth0 endpoints log to the console with `[mock-cigna-auth0]` prefix, including request data, user info, and response bodies for survey/userinfo endpoints.

## Deployed

- **Mock SAML (Sydney)**: `sso-saml.wfh-test.net`
- **Mock Cigna Auth0**: `mock-cigna-auth0.dev.wildflowerhealth.net` (via nginx routing to this service)

## Environment Variables

See `.env.example` for SAML-specific configuration (keys, entity ID, etc.). The Cigna Auth0 mock requires no additional configuration.
