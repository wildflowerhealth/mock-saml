// Helpers shared by the samlify-based IdP mocks (Elevance, UHC): response ids, samlify's
// attribute placeholder naming, and the auto-submitting POST-binding form.

export function randomId(): string {
  // 16 hex chars; matches SAML ID conventions without pulling in a UUID dep.
  return Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

// Mirrors samlify's internal `tagging('attr', valueTag)` from libsaml.js. The
// loginResponseTemplate.attributes processor emits placeholders shaped by this
// rule (e.g. `ProxyID` → `{attrProxyId}`), so customTagReplacement keys must
// match exactly. Re-implementing locally because samlify doesn't export it.
function samlifyCamelCase(input: string): string {
  const words = input
    .replace(/([a-z\d])([A-Z])/g, '$1\0$2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1\0$2')
    .split(/[\0\s\-_.]+/)
    .filter((w) => w.length > 0);
  return words
    .map((w, i) => {
      const lower = w.toLocaleLowerCase('en-US');
      return i === 0 ? lower : lower.charAt(0).toLocaleUpperCase('en-US') + lower.slice(1);
    })
    .join('');
}

export function samlifyAttrTag(content: string): string {
  const camel = samlifyCamelCase(content);
  return 'attr' + camel.charAt(0).toUpperCase() + camel.slice(1);
}

function escapeAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// relayState undefined leaves the RelayState field out, as an IdP-initiated post
// without one does; an empty string still sends the (empty) field.
export function renderAutoPostForm(action: string, samlResponseB64: string, relayState?: string): string {
  const relayStateInput =
    relayState === undefined
      ? ''
      : `\n    <input type="hidden" name="RelayState" value="${escapeAttr(relayState)}" />`;
  return `<!DOCTYPE html>
<html><body>
  <form id="saml-form" method="POST" action="${escapeAttr(action)}">
    <input type="hidden" name="SAMLResponse" value="${escapeAttr(samlResponseB64)}" />${relayStateInput}
  </form>
  <script>document.getElementById('saml-form').submit();</script>
</body></html>`;
}
