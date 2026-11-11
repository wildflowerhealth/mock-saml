import type { NextApiRequest, NextApiResponse } from 'next';
import { isUhcOrderActive } from 'lib/uhcOrders';

/**
 * The mock UHC eligibility API (SYS-20903), in UHC's shape (`POST /hub/1.0.0/eligibility`,
 * user-api's `UHCClient.is_order_active`, portal-facade's UhcClient): whether UHC holds one
 * member's order active. Every order is active except one the mock UHC page signed with "UHC
 * holds this order inactive" (lib/uhcOrders); nothing is remembered between calls.
 */
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).send(`Method ${req.method} Not Allowed`);
  }
  if (!String(req.headers.authorization ?? '').startsWith('Bearer ')) {
    return res.status(401).json({ error: 'missing bearer token' });
  }
  const { memberId, productId, orderItemId } = req.body ?? {};
  if (typeof memberId !== 'string' || typeof orderItemId !== 'string') {
    return res.status(400).json({ error: 'memberId and orderItemId are required' });
  }
  const active = isUhcOrderActive(orderItemId);
  console.log(
    `[mock-uhc] eligibility for EFID ${memberId}, order ${orderItemId}: ${active ? 'active' : 'inactive'}`
  );
  res.status(200).json({
    IS_ACTIVE: active,
    PRODUCT_ID: typeof productId === 'string' ? productId : '',
    ORDER_ITEM_ID: orderItemId,
  });
}
