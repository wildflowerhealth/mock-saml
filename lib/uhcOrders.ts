/**
 * The UHC Store orders the mock UHC page has signed, for the mock UHC eligibility API
 * (pages/api/uhc). app-gateway's UHC sign-in confirms an order with UHC's eligibility API
 * before activation, as user-api did (SYS-20903); UHC's real API knows nothing of the mock's
 * members, so local, dev and stage point at this one instead.
 *
 * Held on globalThis: Next.js bundles each API route on its own, and the page's sign-in and
 * the eligibility call are two routes in one process. In memory only, for as long as a pending
 * sign-in lasts (48 hours), so a restart forgets them and a launch signs a fresh one.
 */
export type UhcOrder = { productId: string };

const HOLD_MS = 48 * 60 * 60 * 1000;

type Held = { order: UhcOrder; until: number };
const globalOrders = globalThis as typeof globalThis & { __mockUhcOrders?: Map<string, Held> };
const orders = (globalOrders.__mockUhcOrders ??= new Map<string, Held>());

const key = (efid: string, orderItemId: string) => `${efid}\u0000${orderItemId}`;

/** An order the mock signed, which UHC is to hold active. */
export function recordUhcOrder(efid: string, orderItemId: string, order: UhcOrder): void {
  orders.set(key(efid, orderItemId), { order, until: Date.now() + HOLD_MS });
}

/** The active order for this member and order item, if the mock signed one. */
export function activeUhcOrder(efid: string, orderItemId: string): UhcOrder | undefined {
  const held = orders.get(key(efid, orderItemId));
  if (!held) return undefined;
  if (held.until < Date.now()) {
    orders.delete(key(efid, orderItemId));
    return undefined;
  }
  return held.order;
}
