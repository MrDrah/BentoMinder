// QA E14 oracle for US-E14-04: a deliberately naive address classifier built from contract 13.6 only (BigInt ranges),
// compared with the engine's isBlockedAddress on fixed and random inputs. Rule: everything the contract names as
// forbidden MUST be blocked by the engine (a miss is a P1). The engine may block more (documentation, benchmarking).
import { describe, expect, it } from 'vitest';
import { isBlockedAddress } from '../../../../server/net/ip.ts';

const cidr4 = (a: number, b: number, c: number, d: number, bits: number): [bigint, bigint] => {
  const base = (BigInt(a) << 24n) | (BigInt(b) << 16n) | (BigInt(c) << 8n) | BigInt(d);
  const size = 1n << BigInt(32 - bits);
  return [base & ~(size - 1n), size];
};
const FORBIDDEN_V4 = [
  cidr4(0, 0, 0, 0, 8), // unspecified / this network
  cidr4(10, 0, 0, 0, 8),
  cidr4(100, 64, 0, 0, 10), // CGNAT
  cidr4(127, 0, 0, 0, 8),
  cidr4(169, 254, 0, 0, 16), // link-local incl. metadata
  cidr4(172, 16, 0, 0, 12),
  cidr4(192, 168, 0, 0, 16),
  cidr4(224, 0, 0, 0, 4), // multicast
  cidr4(240, 0, 0, 0, 4), // reserved incl. broadcast
];
const naiveBlockedV4 = (n: bigint) => FORBIDDEN_V4.some(([base, size]) => n >= base && n < base + size);
const dotted = (n: bigint) => [24n, 16n, 8n, 0n].map((s) => String((n >> s) & 255n)).join('.');

// deterministic PRNG (mulberry32) so a failure reproduces
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe('US-E14-04 oracle: IPv4 forbidden ranges (contract 13.6)', () => {
  it('US-E14-04/AC1 every range edge and 5,000 random addresses: oracle-forbidden implies engine-blocked (0 misses)', () => {
    const rnd = prng(14);
    const probes: bigint[] = [];
    for (const [base, size] of FORBIDDEN_V4) probes.push(base, base + size - 1n, base + size / 2n);
    for (const [base, size] of FORBIDDEN_V4) probes.push(base - 1n >= 0n ? base - 1n : 0n, base + size < 1n << 32n ? base + size : 0n);
    for (let i = 0; i < 5000; i++) probes.push(BigInt(Math.floor(rnd() * 4294967296)));
    const misses: string[] = [];
    let forbidden = 0;
    for (const n of probes) {
      if (naiveBlockedV4(n)) {
        forbidden += 1;
        if (!isBlockedAddress(dotted(n))) misses.push(dotted(n));
      }
    }
    expect(misses).toEqual([]);
    expect(forbidden).toBeGreaterThan(300);
  });
  it('US-E14-04/AC1 known public addresses are not blocked (the engine does not just refuse everything)', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '93.184.215.14', '100.63.255.255', '100.128.0.0', '172.15.255.255', '172.32.0.0', '169.253.255.255', '169.255.0.0', '192.167.255.255', '192.169.0.0', '223.255.255.255', '126.255.255.255', '128.0.0.1', '11.0.0.0', '9.255.255.255']) {
      expect(isBlockedAddress(ip), ip).toBe(false);
    }
  });
  it('US-E14-04/AC1 how much more the engine blocks than the contract requires (informational, bounded to documented special-use ranges)', () => {
    const rnd = prng(99);
    const extra = new Set<string>();
    for (let i = 0; i < 20000; i++) {
      const n = BigInt(Math.floor(rnd() * 4294967296));
      if (!naiveBlockedV4(n) && isBlockedAddress(dotted(n))) extra.add(dotted(n).split('.').slice(0, 2).join('.'));
    }
    const allowedExtraPrefix = /^(192\.0|192\.88|198\.18|198\.19|198\.51|203\.0)$/; // IETF assignments, TEST-NETs, 6to4 anycast, benchmarking
    expect([...extra].filter((p) => !allowedExtraPrefix.test(p))).toEqual([]);
  });
});

describe('US-E14-04 oracle: IPv6 forms that embed or equal a forbidden address', () => {
  const hex = (n: bigint) => [(n >> 16n) & 0xffffn, n & 0xffffn].map((x) => x.toString(16)).join(':');
  it('US-E14-04/AC1 for 3,000 random forbidden IPv4 addresses the mapped, mapped-dotted, expanded and NAT64 / 6to4 forms are blocked', () => {
    const rnd = prng(7);
    let n = 0;
    const misses: string[] = [];
    while (n < 3000) {
      const v = BigInt(Math.floor(rnd() * 4294967296));
      if (!naiveBlockedV4(v)) continue;
      n += 1;
      const forms = [`::ffff:${dotted(v)}`, `::ffff:${hex(v)}`, `0:0:0:0:0:ffff:${hex(v)}`, `[::ffff:${dotted(v)}]`, `64:ff9b::${hex(v)}`, `2002:${hex(v)}::`, `::${dotted(v)}`];
      for (const f of forms) if (!isBlockedAddress(f)) misses.push(f);
    }
    expect(misses).toEqual([]);
  });
  it('US-E14-04/AC1 the contract IPv6 classes: loopback, unspecified, link-local fe80::/10, ULA fc00::/7, multicast ff00::/8', () => {
    const rnd = prng(21);
    const r16 = () => Math.floor(rnd() * 65536).toString(16);
    const tail = () => `${r16()}:${r16()}:${r16()}:${r16()}:${r16()}`;
    const misses: string[] = [];
    for (let i = 0; i < 1500; i++) {
      const fe80 = (0xfe80 + Math.floor(rnd() * 64)).toString(16); // fe80..febf
      const fc = (0xfc00 + Math.floor(rnd() * 512)).toString(16); // fc00..fdff
      const ff = (0xff00 + Math.floor(rnd() * 256)).toString(16);
      for (const a of [`${fe80}:0:0:0:${tail().split(':').slice(0, 4).join(':')}`, `${fc}:${r16()}:${tail()}`, `${ff}:${r16()}:${tail()}`]) if (!isBlockedAddress(a)) misses.push(a);
    }
    for (const a of ['::1', '::', '0:0:0:0:0:0:0:1', '0:0:0:0:0:0:0:0']) if (!isBlockedAddress(a)) misses.push(a);
    expect(misses).toEqual([]);
  });
  it('US-E14-04/AC1 public global-unicast IPv6 is not blocked', () => {
    for (const a of ['2606:4700:4700::1111', '2001:4860:4860::8888', '2a00:1450:4001:81b::200e', '2400:cb00::1']) expect(isBlockedAddress(a), a).toBe(false);
  });
  it('US-E14-04/AC1 garbage and non-literal input is blocked (fail closed)', () => {
    for (const a of ['', 'localhost', '1.2.3', '1.2.3.4.5', '256.1.1.1', '::g', '1:2:3:4:5:6:7:8:9', 'example.test', '0x7f.1', '2130706433']) expect(isBlockedAddress(a), a).toBe(true);
  });
});
