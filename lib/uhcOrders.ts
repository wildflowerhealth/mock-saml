/**
 * How the mock UHC eligibility API (pages/api/uhc) answers, with nothing remembered (SYS-20903).
 * Wildflower confirms a UHC member's order with UHC's eligibility API before activation, as
 * user-api did, and asks again at activation, on the portal's re-fetch and at the end of each
 * year it grants. UHC's real API knows nothing of the mock's members, so local, dev and stage
 * point at this one instead.
 *
 * Every order is active except one whose OrderItemID carries {@link INACTIVE_ORDER_PREFIX}, which
 * the UHC page's "UHC holds this order inactive" signs into the assertion. Nothing is held in
 * memory, so the answer survives a restart or a deploy and stays the same for the whole year
 * Wildflower grants.
 */
export const INACTIVE_ORDER_PREFIX = 'INACTIVE-';

/** The OrderItemID to sign: marked inactive when UHC is to hold the order inactive. */
export function orderItemIdToSign(orderItemId: string, inactive: boolean): string {
  if (!inactive || orderItemId.trim() === '' || orderItemId.startsWith(INACTIVE_ORDER_PREFIX)) {
    return orderItemId;
  }
  return `${INACTIVE_ORDER_PREFIX}${orderItemId}`;
}

/** Whether UHC holds this order active: any order but one signed inactive. */
export const isUhcOrderActive = (orderItemId: string): boolean =>
  !orderItemId.startsWith(INACTIVE_ORDER_PREFIX);
