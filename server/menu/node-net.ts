// Real network adapters for fetchPdf (not used by unit tests). The connection goes to the
// address fetchPdf already validated; the host name is used only for TLS (SNI + certificate
// check) and the Host header, so DNS rebinding between check and connect is impossible.
import { lookup } from 'node:dns/promises';
import { Agent, request as httpsRequest } from 'node:https';
import type { PdfResponse, Requester, ResolvedAddress, Resolver } from './fetch-pdf.ts';

export const nodeResolver: Resolver = async (hostname) => {
  const all = await lookup(hostname, { all: true, verbatim: true });
  const mapped = all.map((a): ResolvedAddress => ({ address: a.address, family: a.family === 6 ? 6 : 4 }));
  return [...mapped.filter((a) => a.family === 4), ...mapped.filter((a) => a.family === 6)]; // IPv4 first (ADR 015 §4)
};

// No connection reuse, no happy-eyeballs: the socket really is the one to the vetted address (ADR 015 §4).
const agent = new Agent({ keepAlive: false, autoSelectFamily: false });

export const nodeRequester: Requester = ({ url, address, signal }) =>
  new Promise<PdfResponse>((resolve, reject) => {
    const req = httpsRequest(
      {
        host: address.address,
        family: address.family,
        agent,
        port: 443,
        servername: url.hostname.replace(/^\[|\]$/g, ''),
        path: `${url.pathname}${url.search}`,
        method: 'GET',
        headers: { host: url.host, accept: 'application/pdf', 'user-agent': 'BentoMinder-menu-fetch/1' },
        signal,
      },
      (res) => {
        const headers: Record<string, string | undefined> = {};
        for (const [k, v] of Object.entries(res.headers)) headers[k] = Array.isArray(v) ? v.join(', ') : v;
        resolve({ status: res.statusCode ?? 0, headers, body: res, destroy: () => res.destroy() });
      },
    );
    req.on('error', reject);
    req.end();
  });
