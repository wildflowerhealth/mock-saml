import type { NextApiRequest, NextApiResponse } from 'next';
import { activeUhcOrder } from 'lib/uhcOrders';

/**
 * The mock UHC eligibility API (SYS-20903), in UHC's shape (`POST /hub/1.0.0/eligibility`,
 * user-api's `UHCClient.is_order_active`, portal-facade's UhcClient): whether UHC holds one
 * member's order active. Active for an order the mock UHC page signed (unless it was launched
 * with "UHC holds the order inactive"); inactive for anything else.
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
  const order = activeUhcOrder(memberId, orderItemId);
  console.log(
    `[mock-uhc] eligibility for EFID ${memberId}, order ${orderItemId}: ${order ? 'active' : 'inactive'}`
  );
  res.status(200).json({
    IS_ACTIVE: order !== undefined,
    PRODUCT_ID: order?.productId ?? (typeof productId === 'string' ? productId : ''),
    ORDER_ITEM_ID: orderItemId,
  });
}
