import { WfhEnv, WfhEnvs } from '@wildflowerhealth/wfh-env';
import { getSamlConfig } from 'utils/settings';
import Head from 'next/head';
import { useRouter } from 'next/router';
import type { FormEvent } from 'react';
import { useEffect, useRef, useState } from 'react';

export default function Sydney() {
 const router = useRouter();
  const { relayState } = router.query;

  const authUrl = '/api/saml/auth-sydney';

  const [state, setState] = useState({
        email: 'testAnthemSSO@wildflowerhealth.com',
        targetEnvironment: 'dev',
        acsUrl: 'https://app-gateway.dev.wildflowerhealth.net/api/sso/saml/wfhMock',
        audience: 'com.wildflowerhealth.saml.dev',
    });

    // Wait until after hydration to update the email with timestamp
    useEffect(() => {
        const timestamp = Math.floor(Date.now() / 1000);
        setState(prevState => ({
            ...prevState,
            email: `testAnthemSSO+${timestamp}@wildflowerhealth.com`
        }));
    }, []);

  const emailInp = useRef<HTMLInputElement>(null);

  const handleChange = (e: FormEvent<HTMLInputElement | HTMLSelectElement>): void => {
    const { name, value } = e.currentTarget;
    console.log(name, value);
    let newState = {...state};
    if (name === 'targetEnvironment') {
        const targetEnv = value as unknown as WfhEnv;
        newState = {
            ...newState,
            acsUrl: getSamlConfig(targetEnv).acs,
            audience: getSamlConfig(targetEnv).audience
        }
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
        email,
        audience: state.audience,
        acsUrl: state.acsUrl,
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
      <div className='flex min-h-full items-center justify-center'>
        <div className='flex w-full max-w-xl flex-col px-3'>
          <div className='space-y-2'>
            <div className='border-2 p-4'>
              <h2 className='mb-5 text-center text-2xl font-bold text-gray-900'>
                Mock Sydney SSO
              </h2>
              <form onSubmit={handleSubmit}>
                <div className='flex flex-col gap-y-3'>
                <div className='form-control'>
                    <label className='label'>
                      <span className='label-text font-bold'>Target WFH Environment</span>
                    </label>
                    <select
                      name='targetEnvironment'
                      id='targetEnvironment'
                      className='select select-bordered'
                      onChange={handleChange}
                      value={state.targetEnvironment}>
                      {WfhEnvs.map((env, index) =>  (
                        <option key={index} value={env}>
                            {env}
                        </option>
                      ))}
                    </select>
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
                      className='input input-bordered'
                      title='Please provide a mock email address'
                    />
                  </div>

                  <button className='btn btn-primary block'>Launch Wildflower</button>
                </div>
              </form>
            </div>
            <div className='mt-6 pt-6 border-t border-gray-200'>
                <div className='flex justify-between items-center'>
                    <h3 className='font-bold text-gray-900'>Current Form Data</h3>
                    <button 
                    type="button" 
                    className="btn btn-xs"
                    onClick={() => navigator.clipboard.writeText(JSON.stringify(state, null, 2))}
                    >
                    Copy
                    </button>
                </div>
                <pre 
                    className='bg-gray-100 p-3 rounded text-sm overflow-auto max-h-40 mt-2 cursor-pointer'
                    onClick={() => navigator.clipboard.writeText(JSON.stringify(state, null, 2))}
                >
                    {JSON.stringify(state, null, 2)}
                </pre>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
