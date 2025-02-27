import { WfhEnv, WfhEnvs, getSamlConfig } from 'utils/settings';
import Head from 'next/head';
import { useRouter } from 'next/router';
import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

export default function Sydney() {
  const router = useRouter();
  const { relayState } = router.query;

  const authUrl = '/api/saml/auth-sydney';

  const [state, setState] = useState({
    firstName: 'Marge',
    lastName: 'Simpson',
    dob: '01/01/1989',
    hcid: 'SIM333M12345',
    email: 'testAnthemSSO@wildflowerhealth.com',
    proxyId: 'WFPDS123456',
    brandId: 'ABC',
    employerId: '993908',
    stateCode: 'CA',
    fundingType: 'FullyFunded',
    targetEnvironment: 'dev',
    acsUrl: 'https://app-gateway.dev.wildflowerhealth.net/api/sso/saml/wfhMock',
    audience: 'com.wildflowerhealth.saml.dev',
  });

  // Wait until after hydration to update the email with timestamp
  useEffect(() => {
    const timestamp = Math.floor(Date.now() / 100);
    setState((prevState) => ({
      ...prevState,
      email: `testAnthemSSO+${timestamp}@wildflowerhealth.com`,
      proxyId: `WFPDS${timestamp}`,
      hcid: `SIM${timestamp}`,
    }));
  }, []);

  const emailInp = useRef<HTMLInputElement>(null);
  const firstNameInp = useRef<HTMLInputElement>(null);
  const lastNameInp = useRef<HTMLInputElement>(null);

  const handleChange = (e: FormEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value } = e.currentTarget;
    let newState = { ...state };
    if (name === 'targetEnvironment') {
      const targetEnv = value as unknown as WfhEnv;
      newState = {
        ...newState,
        acsUrl: getSamlConfig(targetEnv).acs,
        audience: getSamlConfig(targetEnv).audience,
      };
    }
    setState({
      ...newState,
      [name]: value,
    });
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const { email } = state;

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

    if (response.ok) {
      const newDoc = document.open('text/html', 'replace');

      newDoc.write(await response.text());
      newDoc.close();
    } else {
      document.write('Error in getting SAML response');
    }
  };

  return (
    <>
      <Head>
        <title>Mock Syndey Identity Provider </title>
      </Head>
      <div className='flex min-h-full items-start justify-center p-4'>
        <div className='flex w-full max-w-6xl flex-col md:flex-row gap-6'>
          {/* Form Container */}
          <div className='w-full md:w-1/2'>
            <div className='border-2 p-4 rounded-lg'>
              <h2 className='mb-5 text-center text-2xl font-bold text-gray-900'>Mock Sydney SSO</h2>
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

                  <button className='btn btn-primary block mt-4'>Launch Wildflower</button>
                </div>
              </form>
            </div>
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
              <pre
                className='bg-gray-100 p-3 rounded text-sm overflow-auto h-[calc(100%-3rem)] mt-2 cursor-pointer'
                onClick={() => navigator.clipboard.writeText(JSON.stringify(state, null, 2))}>
                {JSON.stringify(state, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
