// US-E14-04/AC2 and AC6, ADR 015 §4: the real network adapters, with node:dns and node:https replaced by spies.
// IPv4 first, one vetted address, no keep-alive, fixed outbound headers. No socket is opened.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ lookupResult: [] as { address: string; family: number }[], options: [] as Record<string, unknown>[] }));

vi.mock('node:dns/promises', () => ({ lookup: () => Promise.resolve(state.lookupResult) }));
vi.mock('node:https', () => {
  class Agent {
    options: Record<string, unknown>;
    constructor(options: Record<string, unknown>) {
      this.options = options;
    }
  }
  return {
    Agent,
    request: (options: Record<string, unknown>) => {
      state.options.push(options);
      return { on: () => undefined, end: () => undefined };
    },
  };
});

const { nodeRequester, nodeResolver } = await import('../../../../server/menu/node-net.ts');

beforeEach(() => {
  state.options = [];
});

describe('US-E14-04/AC2 the resolver puts IPv4 addresses first', () => {
  it('US-E14-04/AC2 a name with IPv6 listed first is returned IPv4 first, all addresses kept for vetting', async () => {
    state.lookupResult = [
      { address: '2606:4700:4700::1111', family: 6 },
      { address: '93.184.215.14', family: 4 },
      { address: '2606:4700:4700::1001', family: 6 },
    ];
    expect(await nodeResolver('example-kinder.test')).toEqual([
      { address: '93.184.215.14', family: 4 },
      { address: '2606:4700:4700::1111', family: 6 },
      { address: '2606:4700:4700::1001', family: 6 },
    ]);
  });
});

describe('US-E14-04/AC2 and AC6 the requester connects to the vetted address only', () => {
  const call = () => void nodeRequester({ url: new URL('https://example-kinder.test/a/menu.pdf?x=1'), address: { address: '93.184.215.14', family: 4 }, signal: new AbortController().signal }).catch(() => undefined);

  it('US-E14-04/AC2 the socket goes to the address, the name is only SNI and Host, no keep-alive, no address-family racing', () => {
    call();
    const o = state.options[0]!;
    expect(o['host']).toBe('93.184.215.14');
    expect(o['family']).toBe(4);
    expect(o['port']).toBe(443);
    expect(o['servername']).toBe('example-kinder.test');
    expect(o['path']).toBe('/a/menu.pdf?x=1');
    const agent = o['agent'] as { options: Record<string, unknown> };
    expect(agent.options).toEqual({ keepAlive: false, autoSelectFamily: false });
  });

  it('US-E14-04/AC6 the outbound headers are a fixed set: no Authorization, cookie or caller token', () => {
    call();
    const headers = (state.options[0]!['headers'] ?? {}) as Record<string, string>;
    expect(Object.keys(headers).sort()).toEqual(['accept', 'host', 'user-agent']);
    expect(JSON.stringify(headers)).not.toMatch(/authorization|cookie|bearer/i);
  });
});
