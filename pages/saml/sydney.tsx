import { WfhEnv, WfhEnvs, getSamlConfig } from 'utils/settings';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState, ChangeEvent, useMemo, FormEvent } from 'react';
import Chance from 'chance';
import Link from 'next/link';
import ToggleButton from 'components/ToggleButton';
import MockEligibility from 'components/MockEligibility';

type FormState = {
  firstName: string;
  lastName: string;
  dob: string;
  hcid: string;
  email: string;
  proxyId: string;
  brandId: string;
  employerId: string;
  stateCode: string;
  fundingType: string;
  targetEnvironment: WfhEnv;
  acsUrl: string;
  audience: string;
};

function removeSpacesAndApostrophes(str: string): string {
  return str.replace(/[ ']/g, '');
}

export default function Sydney() {
  const router = useRouter();
  const { relayState } = router.query;

  const authUrl = '/api/saml/auth-sydney';

  const [state, setState] = useState<FormState>({
    firstName: 'Marge',
    lastName: 'Simpson',
    dob: '01/01/1989',
    hcid: 'SIM333M12345',
    email: 'testAnthemSSO@wildflowerhealth.com',
    proxyId: 'WFPDS123456',
    brandId: 'ABC',
    employerId: '993908',
    stateCode: 'CA',
    fundingType: 'FI',
    targetEnvironment: 'dev' as WfhEnv,
    acsUrl: 'https://anthem.dev.wildflowerhealth.digital/api/sso/saml/wfhMock',
    audience: 'com.wildflowerhealth.saml.dev',
  });

  const [jsonText, setJsonText] = useState<string>('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  // init jsonText state from initial form state
  useEffect(() => {
    setJsonText(JSON.stringify(state, null, 2));
  }, [state]);

  // Wait until after hydration to randomize initial state
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    const timestamp = Math.floor(Date.now() / 100);
    const chance = new Chance();
    const randomFirstName = chance.first({ gender: 'female' });
    const randomLastName = chance.last();
    const email = removeSpacesAndApostrophes(
      `${randomFirstName}.${randomLastName}+test${timestamp}@wildflowerhealth.com`
    ).toLowerCase();
    setState((prevState) => {
      const newState = {
        ...prevState,
        email,
        proxyId: `WFPDS${timestamp}`,
        hcid: `SIM${timestamp}`,
        firstName: randomFirstName,
        lastName: randomLastName,
      };
      // also, update jsonText to match
      setJsonText(JSON.stringify(newState, null, 2));
      return newState;
    });
  }, []); // Empty array ensures this runs only once on mount

  const emailInp = useRef<HTMLInputElement>(null);
  const firstNameInp = useRef<HTMLInputElement>(null);
  const lastNameInp = useRef<HTMLInputElement>(null);
  const jsonTextAreaRef = useRef<HTMLTextAreaElement>(null);
  const [showMockForm, setShowMockForm] = useState(false);

  const handleChange = (e: FormEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value } = e.currentTarget;
    let updatedState = { ...state };
    if (name === 'targetEnvironment') {
      const targetEnv = value as unknown as WfhEnv;
      updatedState = {
        ...updatedState,
        targetEnvironment: targetEnv,
        acsUrl: getSamlConfig(targetEnv).acs,
        audience: getSamlConfig(targetEnv).audience,
      };
    } else {
      updatedState = {
        ...updatedState,
        [name]: value,
      };
    }
    setState(updatedState);

    setJsonText(JSON.stringify(updatedState, null, 2));
  };

  const handleJsonChange = (e: ChangeEvent<HTMLTextAreaElement>): void => {
    const newJsonText = e.target.value;
    setJsonText(newJsonText);

    try {
      const parsedJson = JSON.parse(newJsonText);

      // validate parsed json
      if (typeof parsedJson === 'object' && parsedJson !== null) {
        // use current state for any un-supplied properties in json
        const newState = { ...state };

        // update only props that exist in the json
        Object.keys(state).forEach((key) => {
          if (key in parsedJson && typeof parsedJson[key] !== 'undefined') {
            newState[key as keyof FormState] = parsedJson[key];
          }
        });

        // update targetEnvironment dependents
        if (
          'targetEnvironment' in parsedJson &&
          typeof parsedJson.targetEnvironment === 'string' &&
          WfhEnvs.includes(parsedJson.targetEnvironment as WfhEnv)
        ) {
          const targetEnv = parsedJson.targetEnvironment as WfhEnv;
          newState.targetEnvironment = targetEnv;

          // only update ACS and audience if they weren't set in the JSON
          if (!('acsUrl' in parsedJson)) {
            newState.acsUrl = getSamlConfig(targetEnv).acs;
          }
          if (!('audience' in parsedJson)) {
            newState.audience = getSamlConfig(targetEnv).audience;
          }
        }

        setState(newState);
        setJsonError(null);
      } else {
        setJsonError('JSON must be an object');
      }
    } catch (e) {
      setJsonError('Invalid JSON format');
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const response = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        ...state,
        relayState,
      }),
    });

    // If API says "requiresAuth", bounce straight to GitHub OAuth
    if (response.status === 401) {
      const data = await response.json();
      if (data?.requiresAuth && data?.signInUrl) {
        window.location.href = data.signInUrl;
        return;
      }
    }

    if (response.ok) {
      const newDoc = document.open('text/html', 'replace');

      newDoc.write(await response.text());
      newDoc.close();
    } else {
      document.write('Error in getting SAML response');
    }
  };

  const mockEligibilityInitData = useMemo(
    () => ({
      firstName: state.firstName,
      lastName: state.lastName,
      dob: state.dob,
      hcid: state.hcid,
      email: state.email,
      proxyId: state.proxyId,
      brandId: state.brandId,
      employerId: state.employerId,
      stateCode: state.stateCode,
      fundingType: state.fundingType,
      targetEnvironment: state.targetEnvironment,
    }),
    [state]
  );

  const [session, setSession] = useState<any>(null);
  const allowMockEligibilitySection = !['prod', 'uat'].includes(state.targetEnvironment);
  useEffect(() => {
    setShowMockForm(false);
  }, [allowMockEligibilitySection]);

  useEffect(() => {
    fetch('/api/session')
      .then((r) => r.json())
      .then((data) => setSession(data.session));
  }, []);

  return (
    <>
      <Head>
        <title>Mock Syndey Identity Provider </title>
      </Head>
      <div className='flex items-start justify-center p-4'>
        {session ? (
          <>
            <span>Welcome @{session.login}</span>&nbsp;&nbsp;
            <Link href='/api/gh/logout'>Logout</Link>
          </>
        ) : (
          <Link href='/api/gh/login'>Login with GitHub</Link>
        )}
      </div>
      <div className='flex min-h-full items-start justify-center p-4'>
        <div className='flex w-full max-w-6xl flex-col md:flex-row gap-6'>
          {/* Form Container */}
          <div className='w-full md:w-1/2'>
            <div className='border-2 p-4 rounded-lg'>
              <h2 className='mb-5 text-center text-2xl font-bold text-gray-900'>Mock Sydney SSO</h2>
              <div className='flex justify-end'>
                {allowMockEligibilitySection && (
                  <ToggleButton
                    checked={showMockForm}
                    onChange={setShowMockForm}
                    label='Use Mock Eligibility'
                  />
                )}
              </div>
              <form onSubmit={handleSubmit}>
                <div className='flex flex-col gap-y-3'>
                  <div className='form-control'>
                    <label className='label'>
                      <span className='label-text font-bold'>Target WFH Environment</span>
                    </label>
                    <select
                      name='targetEnvironment'
                      id='targetEnvironment'
                      className='select select-bordered w-full'
                      onChange={handleChange}
                      value={state.targetEnvironment}>
                      {WfhEnvs.map((env, index) => (
                        <option key={index} value={env}>
                          {env}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className='flex flex-col sm:flex-row gap-3'>
                    <div className='form-control flex-1'>
                      <label className='label'>
                        <span className='label-text font-bold'>First Name</span>
                      </label>
                      <input
                        name='firstName'
                        id='firstName'
                        ref={firstNameInp}
                        autoComplete='off'
                        type='text'
                        placeholder='Marge'
                        value={state.firstName}
                        onChange={handleChange}
                        className='input input-bordered w-full'
                        title='Please provide a mock first name'
                      />
                    </div>

                    <div className='form-control flex-1'>
                      <label className='label'>
                        <span className='label-text font-bold'>Last Name</span>
                      </label>
                      <input
                        name='lastName'
                        id='lastName'
                        ref={lastNameInp}
                        autoComplete='off'
                        type='text'
                        placeholder='Simpson'
                        value={state.lastName}
                        onChange={handleChange}
                        className='input input-bordered w-full'
                        title='Please provide a mock last name'
                      />
                    </div>
                  </div>

                  <div className='flex flex-col sm:flex-row gap-3'>
                    <div className='form-control flex-1'>
                      <label className='label'>
                        <span className='label-text font-bold'>DOB</span>
                      </label>
                      <input
                        name='dob'
                        id='dob'
                        autoComplete='off'
                        type='text'
                        placeholder='01/01/1989'
                        value={state.dob}
                        onChange={handleChange}
                        className='input input-bordered w-full'
                        title='Please provide a mock dob'
                      />
                    </div>

                    <div className='form-control flex-1'>
                      <label className='label'>
                        <span className='label-text font-bold'>HCID</span>
                      </label>
                      <input
                        name='hcid'
                        id='hcid'
                        autoComplete='off'
                        type='text'
                        placeholder='SIM333M12345'
                        value={state.hcid}
                        onChange={handleChange}
                        className='input input-bordered w-full'
                        title='Please provide a mock hcid'
                      />
                    </div>
                  </div>

                  <div className='form-control'>
                    <label className='label'>
                      <span className='label-text font-bold'>Email</span>
                    </label>
                    <input
                      name='email'
                      id='email'
                      ref={emailInp}
                      autoComplete='off'
                      type='text'
                      placeholder='noah@wildflowerhealth.com'
                      value={state.email}
                      onChange={handleChange}
                      className='input input-bordered w-full'
                      title='Please provide a mock email address'
                    />
                  </div>

                  <div className='form-control'>
                    <label className='label'>
                      <span className='label-text font-bold'>Proxy Id</span>
                    </label>
                    <input
                      name='proxyId'
                      id='proxyId'
                      autoComplete='off'
                      type='text'
                      placeholder='prox1740635124'
                      value={state.proxyId}
                      onChange={handleChange}
                      className='input input-bordered w-full'
                      title='Please provide a mock proxy Id'
                    />
                  </div>

                  <div className='flex flex-col sm:flex-row gap-3'>
                    <div className='form-control flex-1'>
                      <label className='label'>
                        <span className='label-text font-bold'>Brand Id</span>
                      </label>
                      <input
                        name='brandId'
                        id='brandId'
                        autoComplete='off'
                        type='text'
                        placeholder='ABC'
                        value={state.brandId}
                        onChange={handleChange}
                        className='input input-bordered w-full'
                        title='Please provide a mock brand Id'
                      />
                    </div>

                    <div className='form-control flex-1'>
                      <label className='label'>
                        <span className='label-text font-bold'>Employer Id</span>
                      </label>
                      <input
                        name='employerId'
                        id='employerId'
                        autoComplete='off'
                        type='text'
                        placeholder='993908'
                        value={state.employerId}
                        onChange={handleChange}
                        className='input input-bordered w-full'
                        title='Please provide a mock employer Id'
                      />
                    </div>
                  </div>

                  <div className='flex flex-col sm:flex-row gap-3'>
                    <div className='form-control flex-1'>
                      <label className='label'>
                        <span className='label-text font-bold'>State Code</span>
                      </label>
                      <input
                        name='stateCode'
                        id='stateCode'
                        autoComplete='off'
                        type='text'
                        placeholder='CA'
                        value={state.stateCode}
                        onChange={handleChange}
                        className='input input-bordered w-full'
                        title='Please provide a mock state code'
                      />
                    </div>

                    <div className='form-control flex-1'>
                      <label className='label'>
                        <span className='label-text font-bold'>Funding Type</span>
                      </label>
                      <input
                        name='fundingType'
                        id='fundingType'
                        autoComplete='off'
                        type='text'
                        placeholder=''
                        value={state.fundingType}
                        onChange={handleChange}
                        className='input input-bordered w-full'
                        title='Please provide a mock funding type'
                      />
                    </div>
                  </div>

                  <button className='btn btn-primary block mt-4' disabled={Boolean(jsonError)}>
                    Launch Wildflower
                  </button>
                </div>
              </form>
            </div>
            {allowMockEligibilitySection && showMockForm && (
              <MockEligibility SSOFromData={mockEligibilityInitData} />
            )}
          </div>

          {/* JSON Output */}
          <div className='w-full md:w-1/2'>
            <div className='border-2 p-4 rounded-lg h-full'>
              <div className='flex justify-between items-center mb-3'>
                <h3 className='font-bold text-gray-900'>Current Form Data</h3>
                <button
                  type='button'
                  className='btn btn-xs'
                  onClick={() => navigator.clipboard.writeText(JSON.stringify(state, null, 2))}>
                  Copy
                </button>
              </div>
              {jsonError && (
                <div className='bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-2'>
                  {jsonError}
                </div>
              )}
              <textarea
                ref={jsonTextAreaRef}
                className='w-full bg-gray-100 p-3 rounded text-sm font-mono h-[calc(100%-3rem)] mt-2'
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
