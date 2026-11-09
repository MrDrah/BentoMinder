// SSRF guard (ADR 002 §2): which resolved addresses the proxy may connect to. Anything that is
// not plainly public unicast is blocked: loopback, private, link-local (incl. cloud metadata
// 169.254.169.254), CGNAT, ULA, multicast, documentation/benchmark/reserved ranges, and the
// IPv6 forms that embed an IPv4 address (IPv4-mapped, IPv4-compatible, NAT64, 6to4), which are
// judged by the embedded IPv4 address. Unparseable input is blocked.
import { isIP } from 'node:net';

type V4Range = readonly [base: number, bits: number];

const v4 = (a: number, b: number, c: number, d: number): number => ((a << 24) >>> 0) + (b << 16) + (c << 8) + d;

const BLOCKED_V4: readonly V4Range[] = [
  [v4(0, 0, 0, 0), 8], // "this network"
  [v4(10, 0, 0, 0), 8], // private
  [v4(100, 64, 0, 0), 10], // CGNAT
  [v4(127, 0, 0, 0), 8], // loopback
  [v4(169, 254, 0, 0), 16], // link-local, cloud metadata
  [v4(172, 16, 0, 0), 12], // private
  [v4(192, 0, 0, 0), 24], // IETF protocol assignments
  [v4(192, 0, 2, 0), 24], // TEST-NET-1
  [v4(192, 88, 99, 0), 24], // 6to4 relay anycast
  [v4(192, 168, 0, 0), 16], // private
  [v4(198, 18, 0, 0), 15], // benchmarking
  [v4(198, 51, 100, 0), 24], // TEST-NET-2
  [v4(203, 0, 113, 0), 24], // TEST-NET-3
  [v4(224, 0, 0, 0), 4], // multicast
  [v4(240, 0, 0, 0), 4], // reserved + broadcast
];

function inRange(value: number, [base, bits]: V4Range): boolean {
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return ((value & mask) >>> 0) === ((base & mask) >>> 0);
}

export function parseIPv4(text: string): number | null {
  const parts = text.split('.');
  if (parts.length !== 4) return null;
  let n = 0;
  for (const p of parts) {
    if (!/^\d{1,3}$/.test(p)) return null;
    const x = Number(p);
    if (x > 255) return null;
    n = n * 256 + x;
  }
  return n;
}

/** 8 groups of 16 bits, or null. Accepts `::` compression and a trailing dotted IPv4. */
export function parseIPv6(text: string): number[] | null {
  let s = text.toLowerCase();
  const zone = s.indexOf('%');
  if (zone >= 0) s = s.slice(0, zone);
  let tail: number[] = [];
  const lastColon = s.lastIndexOf(':');
  if (s.slice(lastColon + 1).includes('.')) {
    const four = parseIPv4(s.slice(lastColon + 1));
    if (four === null) return null;
    tail = [four >>> 16, four & 0xffff];
    s = `${s.slice(0, lastColon + 1)}${tail.length > 0 ? '0:0' : ''}`;
  }
  const halves = s.split('::');
  if (halves.length > 2) return null;
  const group = (h: string) => (h === '' ? [] : h.split(':'));
  const head = group(halves[0] ?? '');
  const rest = halves.length === 2 ? group(halves[1] ?? '') : [];
  const all = [...head, ...rest];
  if (all.some((g) => !/^[0-9a-f]{1,4}$/.test(g))) return null;
  const missing = 8 - all.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;
  const groups = [...head, ...Array<string>(halves.length === 2 ? missing : 0).fill('0'), ...rest].map((g) => parseInt(g, 16));
  if (tail.length === 2) {
    groups[6] = tail[0] as number;
    groups[7] = tail[1] as number;
  }
  return groups;
}

export function isBlockedIPv4(value: number): boolean {
  return BLOCKED_V4.some((r) => inRange(value, r));
}

function embeddedV4(g: number[]): number {
  return (((g[6] as number) << 16) >>> 0) + (g[7] as number);
}

export function isBlockedIPv6(g: number[]): boolean {
  const [a = 0, b = 0, c = 0, d = 0, e = 0, f = 0] = g;
  const zeroTo = (n: number) => g.slice(0, n).every((x) => x === 0);
  if (g.every((x) => x === 0)) return true; // ::
  if (zeroTo(7) && g[7] === 1) return true; // ::1
  if (zeroTo(5) && f === 0xffff) return isBlockedIPv4(embeddedV4(g)); // ::ffff:a.b.c.d (IPv4-mapped)
  if (zeroTo(4) && e === 0xffff && f === 0) return true; // ::ffff:0:a.b.c.d (IPv4-translated, ::ffff:0:0:0/96; E14-D01)
  if (zeroTo(6)) return true; // ::a.b.c.d (deprecated IPv4-compatible) and other ::/96
  if (a === 0x0064 && b === 0xff9b && zeroTo(0) && c === 0 && d === 0 && e === 0 && f === 0) return isBlockedIPv4(embeddedV4(g)); // NAT64 64:ff9b::/96
  if (a === 0x0064 && b === 0xff9b && c === 0x0001) return true; // local-use NAT64 64:ff9b:1::/48
  if (a === 0x0100 && b === 0 && c === 0 && d === 0) return true; // discard 100::/64
  if (a === 0x2001 && b === 0x0db8) return true; // documentation
  if (a === 0x2001 && b < 0x0200) return true; // 2001::/23 IETF special (incl. Teredo 2001::/32)
  if (a === 0x2002) return isBlockedIPv4(((b << 16) >>> 0) + c); // 6to4 embeds an IPv4 address
  if ((a & 0xfe00) === 0xfc00) return true; // ULA fc00::/7 (incl. fd00:ec2::254 metadata)
  if ((a & 0xffc0) === 0xfe80) return true; // link-local fe80::/10
  if ((a & 0xffc0) === 0xfec0) return true; // site-local fec0::/10 (deprecated)
  if ((a & 0xff00) === 0xff00) return true; // multicast
  return false;
}

/** True when the proxy must not connect to `address` (an IP literal). */
export function isBlockedAddress(address: string): boolean {
  const kind = isIP(address.replace(/^\[|\]$/g, ''));
  const plain = address.replace(/^\[|\]$/g, '');
  if (kind === 4) {
    const n = parseIPv4(plain);
    return n === null || isBlockedIPv4(n);
  }
  if (kind === 6) {
    const g = parseIPv6(plain);
    return g === null || isBlockedIPv6(g);
  }
  return true;
}
