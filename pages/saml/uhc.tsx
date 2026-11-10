import Head from 'next/head';
import { useRouter } from 'next/router';
import { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import Chance from 'chance';
import type { UhcUserAttributes } from 'types';
import { UhcWfhEnv, UhcWfhEnvs, getUhcAcsUrl } from 'utils/settings';
import { UHC_IDP_ENTITY_ID, UHC_LEGACY_AUDIENCE, UHC_LEGACY_DESTINATION } from 'lib/uhc';

type UhcFormData = UhcUserAttributes & {
  targetEnvironment: UhcWfhEnv;
  acsUrl: string;
  efid: string;
  signWithThrowawayKey: boolean;
  /** SYS-20903: the mock UHC eligibility API answers this sign-in's order inactive */
  orderInactive: boolean;
};

type PresetKey = 'linked' | 'link' | 'new' | 'otherPlatform';

type Preset = {
  key: PresetKey;
  label: string;
  // What the target environment must already hold for app-gateway to give this answer.
  expects: string;
  identity: () => Pick<UhcFormData, 'efid' | 'Email'>;
};

const freshEfid = () => `MOCKUHC${Math.floor(Date.now() / 100)}`;

const freshEmail = (firstName: string, lastName: string) =>
  `${firstName}.${lastName}+uhc${Math.floor(Date.now() / 100)}@wildflowerhealth.com`
    .replace(/[ ']/g, '')
    .toLowerCase();

// The four outcomes app-gateway's Every Mother provider answers (I4, SYS-20903). They
// differ only in the EFID and email sent; the records behind them live in the target
// environment.
const PRESETS: Preset[] = [
  {
    key: 'linked',
    label: 'Linked member in good standing',
    expects:
      'An account linked to EFID MOCKUHC-LINKED with an active UHC subscription. Answer: 303 with token.',
    identity: () => ({ efid: 'MOCKUHC-LINKED', Email: 'uhc-mock+linked@wildflowerhealth.com' }),
  },
  {
    key: 'link',
    label: 'Account to link',
    expects:
      'An account with this email, no UHC link and no active subscription. Answer: 303 with pending_link_id.',
    identity: () => ({ efid: freshEfid(), Email: 'uhc-mock+link@wildflowerhealth.com' }),
  },
  {
    key: 'new',
    label: 'New member',
    expects: 'Nothing: a fresh EFID and email. Answer: 303 with pending_saml_id and is_new_user=1.',
    identity: () => ({ efid: freshEfid(), Email: '' }),
  },
  {
    key: 'otherPlatform',
    label: 'Member paying elsewhere',
    expects:
      'An account with this email and an active app-store or Chargebee subscription. Answer: 303 with error=active_membership_with_other_platform.',
    identity: () => ({ efid: freshEfid(), Email: 'uhc-mock+other-platform@wildflowerhealth.com' }),
  },
];

// Grounded defaults come from user-api: its staging plan id (202642_Annual), the values its
// parser expects (New, Active) and its UHC fixtures (UUID order item and vendor ids). DOB,
// ProgramType and UHC_Source_App have no observed sample; user-api ignores all three.
const ATTRIBUTE_FIELDS: { name: keyof UhcUserAttributes; hint?: string }[] = [
  { name: 'FirstName' },
  { name: 'LastName' },
  { name: 'Email' },
  { name: 'DOB', hint: 'placeholder' },
  { name: 'ProductID' },
  { name: 'OrderItemID' },
  { name: 'TransactionType' },
  { name: 'SubscriptionStatus' },
  { name: 'ProgramType', hint: 'placeholder' },
  { name: 'UHC_Source_App', hint: 'placeholder' },
  { name: 'VID' },
];

const INITIAL_ENV: UhcWfhEnv = 'local';

export default function Uhc() {
  const router = useRouter();
  const { relayState } = router.query;

  const [form, setForm] = useState<UhcFormData>({
    targetEnvironment: INITIAL_ENV,
    acsUrl: getUhcAcsUrl(INITIAL_ENV),
    efid: 'MOCKUHC0000000000',
    VID: '',
    TransactionType: 'New',
    Email: '',
    SubscriptionStatus: 'Active',
    FirstName: '',
    DOB: '1990-01-01',
    ProductID: '202642_Annual',
    LastName: '',
    ProgramType: 'EveryMother',
    UHC_Source_App: 'UHCStore',
    OrderItemID: '',
    signWithThrowawayKey: false,
    orderInactive: false,
  });
  const [activePreset, setActivePreset] = useState<PresetKey>('new');
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const applyPreset = (preset: Preset, base: UhcFormData): UhcFormData => {
    const chance = new Chance();
    const FirstName = chance.first({ gender: 'female' });
    const LastName = chance.last();
    const identity = preset.identity();
    return {
      ...base,
      FirstName,
      LastName,
      efid: identity.efid,
      Email: identity.Email || freshEmail(FirstName, LastName),
      OrderItemID: crypto.randomUUID(),
      VID: crypto.randomUUID(),
    };
  };

  const updateForm = (next: UhcFormData) => {
    setForm(next);
    setJsonText(JSON.stringify(next, null, 2));
    setJsonError(null);
  };

  // Randomize after hydration so server and client render the same first frame.
  useEffect(() => {
    updateForm(applyPreset(PRESETS[2], form));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handlePreset = (preset: Preset) => {
    setActivePreset(preset.key);
    updateForm(applyPreset(preset, form));
  };

  const handleChange = (e: FormEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value, type } = e.currentTarget;
    if (name === 'targetEnvironment') {
      const targetEnvironment = value as UhcWfhEnv;
      updateForm({ ...form, targetEnvironment, acsUrl: getUhcAcsUrl(targetEnvironment) });
    } else if (type === 'checkbox') {
      updateForm({ ...form, [name]: (e.currentTarget as HTMLInputElement).checked });
    } else {
      updateForm({ ...form, [name]: value });
    }
  };

  const handleJsonChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const text = e.target.value;
    setJsonText(text);
    try {
      const parsed = JSON.parse(text);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setJsonError('JSON must be an object');
        return;
      }
      const next = { ...form };
      (Object.keys(form) as (keyof UhcFormData)[]).forEach((key) => {
        if (key in parsed && typeof parsed[key] === typeof form[key]) {
          (next as Record<keyof UhcFormData, unknown>)[key] = parsed[key];
        }
      });
      if (!UhcWfhEnvs.includes(next.targetEnvironment)) {
        setJsonError(`targetEnvironment must be one of ${UhcWfhEnvs.join(', ')}`);
        return;
      }
      setForm(next);
      setJsonError(null);
    } catch {
      setJsonError('Invalid JSON format');
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    const response = await fetch('/api/saml/auth-uhc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...form, relayState: typeof relayState === 'string' ? relayState : '' }),
    });

    if (response.ok) {
      const newDoc = document.open('text/html', 'replace');
      newDoc.write(await response.text());
      newDoc.close();
    } else {
      setSubmitting(false);
      document.write(`Error in getting SAML response: ${await response.text()}`);
    }
  };

  const preset = PRESETS.find((p) => p.key === activePreset);

  return (
    <>
      <Head>
        <title>Mock UHC Identity Provider</title>
      </Head>
      <div className='flex min-h-full items-start justify-center p-4'>
        <div className='flex w-full max-w-6xl flex-col gap-6 md:flex-row'>
          <div className='w-full md:w-1/2'>
            <div className='rounded-lg border-2 p-4'>
              <h2 className='mb-2 text-center text-2xl font-bold text-gray-900'>Mock UHC SSO</h2>
              <p className='mb-4 text-center text-sm text-gray-600'>
                Every Mother&apos;s UHC sign-in, as Optum&apos;s staging IdP sends it. Local, dev and stage
                only; iat uses Optum&apos;s real staging IdP.
              </p>
              <form onSubmit={handleSubmit}>
                <div className='flex flex-col gap-y-3'>
                  <div className='form-control'>
                    <label className='label' htmlFor='targetEnvironment'>
                      <span className='label-text font-bold'>Target WFH Environment</span>
                    </label>
                    <select
                      name='targetEnvironment'
                      id='targetEnvironment'
                      className='select select-bordered w-full'
                      onChange={handleChange}
                      value={form.targetEnvironment}>
                      {UhcWfhEnvs.map((env) => (
                        <option key={env} value={env}>
                          {env}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className='form-control'>
                    <label className='label' htmlFor='acsUrl'>
                      <span className='label-text font-bold'>Post to (assertion address)</span>
                    </label>
                    <input
                      name='acsUrl'
                      id='acsUrl'
                      autoComplete='off'
                      type='text'
                      value={form.acsUrl}
                      onChange={handleChange}
                      className='input input-bordered w-full font-mono text-sm'
                    />
                  </div>

                  <div className='rounded bg-gray-100 p-3 text-xs text-gray-700'>
                    <div>
                      <span className='font-bold'>Issuer</span> <code>{UHC_IDP_ENTITY_ID}</code>
                    </div>
                    <div>
                      <span className='font-bold'>Audience</span> <code>{UHC_LEGACY_AUDIENCE}</code>
                    </div>
                    <div>
                      <span className='font-bold'>Destination</span> <code>{UHC_LEGACY_DESTINATION}</code>
                    </div>
                    <div className='mt-1'>
                      Fixed whatever the post target: the address Optum has on file for user-api.
                    </div>
                  </div>

                  <div className='form-control'>
                    <span className='label-text mb-2 font-bold'>Outcome preset</span>
                    <div className='flex flex-wrap gap-2'>
                      {PRESETS.map((p) => (
                        <button
                          key={p.key}
                          type='button'
                          className={`btn btn-sm ${p.key === activePreset ? 'btn-primary' : 'btn-outline'}`}
                          onClick={() => handlePreset(p)}>
                          {p.label}
                        </button>
                      ))}
                    </div>
                    {preset && <p className='mt-2 text-xs text-gray-600'>Needs: {preset.expects}</p>}
                  </div>

                  <div className='form-control'>
                    <label className='label' htmlFor='efid'>
                      <span className='label-text font-bold'>Member EFID (NameID)</span>
                    </label>
                    <input
                      name='efid'
                      id='efid'
                      autoComplete='off'
                      type='text'
                      value={form.efid}
                      onChange={handleChange}
                      className='input input-bordered w-full'
                      required
                    />
                  </div>

                  <div className='grid grid-cols-1 gap-3 sm:grid-cols-2'>
                    {ATTRIBUTE_FIELDS.map(({ name, hint }) => (
                      <div className='form-control' key={name}>
                        <label className='label' htmlFor={name}>
                          <span className='label-text font-bold'>{name}</span>
                          {hint && <span className='label-text-alt text-gray-500'>{hint}</span>}
                        </label>
                        <input
                          name={name}
                          id={name}
                          autoComplete='off'
                          type='text'
                          value={form[name]}
                          onChange={handleChange}
                          className='input input-bordered w-full'
                        />
                      </div>
                    ))}
                  </div>
                  <p className='text-xs text-gray-600'>
                    A blank attribute is left out of the assertion, as a missing attribute arrives from Optum.
                    Without Email, app-gateway answers error=email_missing; the others are optional, as for
                    user-api.
                  </p>

                  <label className='label cursor-pointer justify-start gap-3'>
                    <input
                      type='checkbox'
                      name='signWithThrowawayKey'
                      className='checkbox'
                      checked={form.signWithThrowawayKey}
                      onChange={handleChange}
                    />
                    <span className='label-text'>Sign with a throwaway key (app-gateway must refuse it)</span>
                  </label>

                  <label className='label cursor-pointer justify-start gap-3'>
                    <input
                      type='checkbox'
                      name='orderInactive'
                      className='checkbox'
                      checked={form.orderInactive}
                      onChange={handleChange}
                    />
                    <span className='label-text'>
                      UHC holds this order inactive (the mock eligibility API at /api/uhc says so; activation
                      then can&apos;t find the order)
                    </span>
                  </label>

                  <button className='btn btn-primary mt-2 block' disabled={Boolean(jsonError) || submitting}>
                    {submitting ? 'Signing…' : 'Launch Every Mother'}
                  </button>
                </div>
              </form>
            </div>
          </div>

          <div className='w-full md:w-1/2'>
            <div className='h-full rounded-lg border-2 p-4'>
              <div className='mb-3 flex items-center justify-between'>
                <h3 className='font-bold text-gray-900'>Current Form Data</h3>
                <button
                  type='button'
                  className='btn btn-xs'
                  onClick={() => navigator.clipboard.writeText(jsonText)}>
                  Copy
                </button>
              </div>
              {jsonError && (
                <div className='mb-2 rounded border border-red-400 bg-red-100 px-4 py-2 text-red-700'>
                  {jsonError}
                </div>
              )}
              <textarea
                className='mt-2 h-[calc(100%-3rem)] w-full rounded bg-gray-100 p-3 font-mono text-sm'
                value={jsonText}
                onChange={handleJsonChange}
                style={{ resize: 'none' }}
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
