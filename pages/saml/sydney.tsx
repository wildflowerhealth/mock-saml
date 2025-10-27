/* eslint-disable react-hooks/exhaustive-deps */
import { WfhEnv, WfhEnvs, getSamlConfig } from 'utils/settings';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState, ChangeEvent, useMemo, FormEvent } from 'react';
import Chance from 'chance';
import Link from 'next/link';
import ToggleButton from 'components/ToggleButton';
import MockEligibility, { EligibilityFormData } from 'components/MockEligibility';

export type SSOFormData = {
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
  const initialTargetEnv = 'dev' as WfhEnv;

  const [ssoFormState, setSSOFormState] = useState<SSOFormData>({
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
    targetEnvironment: initialTargetEnv,
    acsUrl: getSamlConfig(initialTargetEnv).acs,
    audience: getSamlConfig(initialTargetEnv).audience,
  });

  const [jsonTextState, setJsonTextState] = useState<string>('');
  const [jsonErrorState, setJsonErrorState] = useState<string | null>(null);
  const [eligibilityDataFromJson, setEligibilityDataFromJson] = useState<EligibilityFormData | null>(null);
  const [eligibilityDataFromForm, setEligibilityDataFromForm] = useState<EligibilityFormData | null>(null);

  // init jsonText state from initial form states
  useEffect(() => {
    if (showMockEligibilityForm) {
      setJsonTextState(
        JSON.stringify({ ...ssoFormState, eligibilityData: eligibilityDataFromForm }, null, 2)
      );
    } else if (eligibilityDataFromJson) {
      setJsonTextState(
        JSON.stringify({ ...ssoFormState, eligibilityData: eligibilityDataFromJson }, null, 2)
      );
    } else {
      setJsonTextState(JSON.stringify({ ...ssoFormState }, null, 2));
    }
  }, [ssoFormState]);

  // Wait until after hydration to randomize initial state
  useEffect(() => {
    const timestamp = Math.floor(Date.now() / 100);
    const chance = new Chance();
    const randomFirstName = chance.first({ gender: 'female' });
    const randomLastName = chance.last();
    const email = removeSpacesAndApostrophes(
      `${randomFirstName}.${randomLastName}+test${timestamp}@wildflowerhealth.com`
    ).toLowerCase();
    setSSOFormState((prevState) => {
      const newState = {
        ...prevState,
        email,
        proxyId: `WFPDS${timestamp}`,
        hcid: `SIM${timestamp}`,
        firstName: randomFirstName,
        lastName: randomLastName,
      };
      // also, update jsonText to match
      setJsonTextState(JSON.stringify(newState, null, 2));
      return newState;
    });
  }, []); // Empty array ensures this runs only once on mount

  const emailInp = useRef<HTMLInputElement>(null);
  const firstNameInp = useRef<HTMLInputElement>(null);
  const lastNameInp = useRef<HTMLInputElement>(null);
  const jsonTextAreaRef = useRef<HTMLTextAreaElement>(null);
  const [showMockEligibilityForm, setShowMockEligibilityForm] = useState(false);
  const [useReactNative, setUseReactNative] = useState(false);
  const [isSubmittingWithMockEligibility, setIsSubmittingWithMockEligibility] = useState(false);

  const handleChange = (e: FormEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value } = e.currentTarget;
    let updatedState = { ...ssoFormState };
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
    setSSOFormState(updatedState);
    setJsonTextState(JSON.stringify({ ...ssoFormState }, null, 2));
  };

  const handleEligibilityDataChange = (eligibilityFormData: EligibilityFormData) => {
    setEligibilityDataFromForm(eligibilityFormData);
    setJsonTextState(JSON.stringify({ ...ssoFormState, eligibilityFormData }, null, 2));
  };

  const handleEligibilityFormToggle = (e: boolean) => {
    setShowMockEligibilityForm(e);
    // if the toggle is off, remove eligibility data from the json text
    if (!e) {
      setJsonTextState(JSON.stringify({ ...ssoFormState }, null, 2));
    }
  };

  const handleJsonChange = (e: ChangeEvent<HTMLTextAreaElement>): void => {
    const newJsonText = e.target.value;
    setJsonTextState(newJsonText);

    try {
      const parsedJson = JSON.parse(newJsonText);

      // validate parsed json
      if (typeof parsedJson === 'object' && parsedJson !== null) {
        // use current state for any un-supplied properties in json
        const newState = { ...ssoFormState };

        // update only props that exist in the json
        Object.keys(ssoFormState).forEach((key) => {
          if (key in parsedJson && typeof parsedJson[key] !== 'undefined') {
            newState[key as keyof SSOFormData] = parsedJson[key];
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

        // handle eligibilityFormData if it exists in the pasted JSON
        if ('eligibilityFormData' in parsedJson && typeof parsedJson.eligibilityFormData === 'object') {
          setEligibilityDataFromJson(parsedJson.eligibilityFormData as EligibilityFormData);
          setShowMockEligibilityForm(true);
        } else {
          setEligibilityDataFromJson(null);
        }

        setSSOFormState(newState);
        setJsonErrorState(null);
      } else {
        setJsonErrorState('JSON must be an object');
      }
    } catch (e) {
      setJsonErrorState('Invalid JSON format');
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // If Mock Eligibility is enabled, save that data first
    if (showMockEligibilityForm && eligibilityDataFromForm) {
      setIsSubmittingWithMockEligibility(true);
      try {
        const mockEligibilityUrl = '/api/saml/mock-eligibility';
        const mockEligibilityResponse = await fetch(mockEligibilityUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(eligibilityDataFromForm),
        });

        if (!mockEligibilityResponse.ok) {
          setIsSubmittingWithMockEligibility(false);
          alert('Error saving Mock Eligibility data. SSO submission cancelled.');
          return;
        }
      } catch (error) {
        setIsSubmittingWithMockEligibility(false);
        alert('Error saving Mock Eligibility data. SSO submission cancelled.');
        return;
      }
    }

    // if useReactNative is set, and there is an acsReactNative URL for the target env, use that
    let body: Record<string, any> = { ...ssoFormState, relayState: relayState ?? '' };
    if (!useReactNative) {
      const acsCordovaWebAppDomain = getSamlConfig(ssoFormState.targetEnvironment).acsCordovaWebAppDomain;
      if (acsCordovaWebAppDomain) {
        body = { ...ssoFormState, acsUrl: acsCordovaWebAppDomain };
      }
    }

    const response = await fetch(authUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
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
      setIsSubmittingWithMockEligibility(false);
      document.write('Error in getting SAML response');
    }
  };

  const mockEligibilityInitData = useMemo(
    () => ({
      firstName: ssoFormState.firstName,
      lastName: ssoFormState.lastName,
      dob: ssoFormState.dob,
      hcid: ssoFormState.hcid,
      email: ssoFormState.email,
      proxyId: ssoFormState.proxyId,
      brandId: ssoFormState.brandId,
      employerId: ssoFormState.employerId,
      stateCode: ssoFormState.stateCode,
      fundingType: ssoFormState.fundingType,
      targetEnvironment: ssoFormState.targetEnvironment,
      audience: ssoFormState.audience,
      acsUrl: ssoFormState.acsUrl,
    }),
    [ssoFormState]
  );

  const [session, setSession] = useState<any>(null);

  const allowMockEligibilitySection = !['prod', 'uat'].includes(ssoFormState.targetEnvironment);
  useEffect(() => {
    setShowMockEligibilityForm(false);
  }, [allowMockEligibilitySection]);

  const allowUseReactNativeToggle = !['prod', 'uat'].includes(ssoFormState.targetEnvironment);
  useEffect(() => {
    setUseReactNative(false);
  }, [allowUseReactNativeToggle]);

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
              <div className='flex justify-center gap-4 mb-4'>
                {allowMockEligibilitySection && (
                  <ToggleButton
                    checked={showMockEligibilityForm}
                    onChange={handleEligibilityFormToggle}
                    label='Use Mock Eligibility'
                  />
                )}
                {allowUseReactNativeToggle && (
                  <ToggleButton
                    checked={useReactNative}
                    onChange={setUseReactNative}
                    label='Use React Native App'
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
                      value={ssoFormState.targetEnvironment}>
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
                        value={ssoFormState.firstName}
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
                        value={ssoFormState.lastName}
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
                        value={ssoFormState.dob}
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
                        value={ssoFormState.hcid}
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
                      value={ssoFormState.email}
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
                      value={ssoFormState.proxyId}
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
                        value={ssoFormState.brandId}
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
                        value={ssoFormState.employerId}
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
                        value={ssoFormState.stateCode}
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
                        value={ssoFormState.fundingType}
                        onChange={handleChange}
                        className='input input-bordered w-full'
                        title='Please provide a mock funding type'
                      />
                    </div>
                  </div>

                  <button
                    className='btn btn-primary block mt-4'
                    disabled={Boolean(jsonErrorState) || isSubmittingWithMockEligibility}>
                    {isSubmittingWithMockEligibility ? 'Saving Mock Eligibility...' : 'Launch Wildflower'}
                  </button>
                </div>
              </form>
            </div>
            {allowMockEligibilitySection && showMockEligibilityForm && (
              <MockEligibility
                SSOFormData={mockEligibilityInitData}
                onDataChange={handleEligibilityDataChange}
                onMount={handleEligibilityDataChange}
                eligibilityDataFromJson={eligibilityDataFromJson}
                hideSaveButton={true}
              />
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
                  onClick={() => navigator.clipboard.writeText(jsonTextState)}>
                  Copy
                </button>
              </div>
              {jsonErrorState && (
                <div className='bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded mb-2'>
                  {jsonErrorState}
                </div>
              )}
              <textarea
                ref={jsonTextAreaRef}
                className='w-full bg-gray-100 p-3 rounded text-sm font-mono h-[calc(100%-3rem)] mt-2'
                value={jsonTextState}
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
