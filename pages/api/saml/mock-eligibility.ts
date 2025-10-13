import type { NextApiRequest, NextApiResponse } from 'next';
import { getSamlConfig, WfhEnv } from '../../../utils/settings';

const formatDate = (dateStr: string, delimiter = '') => {
  const parts = dateStr.split('/');
  if (parts.length === 3) {
    const [month, day, year] = parts;
    return `${year}${delimiter}${month.padStart(2, '0')}${delimiter}${day.padStart(2, '0')}`;
  }
  return dateStr;
};

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).send(`Method ${req.method} Not Allowed`);
  }
  const data = req.body;
  const mockResponse = {
    proxyId: data.proxyId,
    hcid: data.hcid,
    email: data.email,
    dob: formatDate(data.dob, '-'),
    firstNm: data.firstName,
    lastNm: data.lastName,
    gender: data.gender,
    subRelation: data.subRelation,
    zipCd: data.zipCode,
    contract: [
      {
        brandCd: data.brandCd,
        groupId: data.groupId,
        underwritingStateCd: data.underwritingStateCd,
        fundingTypeCd: data.fundingTypeCd,
        state: data.stateCode,
        cvrgStartDt: formatDate(data.cvrgStartDt),
        cvrgEndDt: formatDate(data.cvrgEndDt),
        programId: data.programId,
        programIdNm: data.programNm,
      },
    ],
  };
  const storeMockUrl = getSamlConfig(data.targetEnvironment as WfhEnv).mockEligibility;
  const apiKey = getSamlConfig(data.targetEnvironment as WfhEnv).agApiKey;
  if (storeMockUrl && apiKey) {
    try {
      const response = await fetch(storeMockUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify(mockResponse),
      });
      if (response.ok) {
        return res.status(200).json({ success: true, message: 'Mock Response was saved' });
      }
      const error = await response.text();
      return res
        .status(200)
        .json({ success: false, message: `Status: ${response.status}. ${error && `Msg: ${error}`}` });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(200).json({ success: false, message: error.message });
      }
    }
  }
  return res.status(200).json({
    success: false,
    message: `Mock Eligibility not supported for this ENV: ${data.targetEnvironment}`,
  });
}
