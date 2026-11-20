import assert from "node:assert/strict";
import {
  canonicalIp,
  clientIp,
  parseIpSource,
} from "../../accounts/clientIp.ts";

Deno.test("IP source selection is explicit, development gated and trusted header has no fallback", () => {
  for (
    const value of [
      undefined,
      "",
      "auto",
      "header:",
      "header:authorization",
      "development",
    ]
  ) assert.throws(() => parseIpSource(value, false));
  assert.equal(
    clientIp(parseIpSource("development", true), new Headers()),
    "development",
  );
  assert.equal(
    clientIp(parseIpSource("la13", false), new Headers()),
    undefined,
  );
  const source = parseIpSource("header:cf-connecting-ip", false);
  assert.equal(
    clientIp(source, new Headers({ "cf-connecting-ip": "192.0.2.1" })),
    "v4:192.0.2.1",
  );
  assert.throws(() =>
    clientIp(source, new Headers({ "x-forwarded-for": "192.0.2.1" }))
  );
  assert.throws(() =>
    clientIp(
      source,
      new Headers({ "cf-connecting-ip": "192.0.2.1, 192.0.2.2" }),
    )
  );
});

Deno.test("IPv4 canonicalization, IPv6 /64 and mapped addresses share stable subjects", () => {
  assert.equal(canonicalIp("192.000.002.001"), "v4:192.0.2.1");
  assert.equal(canonicalIp("::ffff:192.0.2.1"), canonicalIp("192.0.2.1"));
  assert.equal(
    canonicalIp("0:0:0:0:0:ffff:c000:0201"),
    canonicalIp("192.0.2.1"),
  );
  assert.equal(
    canonicalIp("2001:db8:abcd:12::1"),
    canonicalIp("2001:0db8:abcd:0012:ffff:ffff:ffff:ffff"),
  );
  assert.notEqual(
    canonicalIp("2001:db8:abcd:13::1"),
    canonicalIp("2001:db8:abcd:12::1"),
  );
  for (
    const value of [
      "192.0.2.256",
      "127.1",
      "0x7f000001",
      "[::1]",
      "fe80::1%eth0",
      "::1:443:xyz",
      "1:2:3:4:5:6:7",
      "1:::2",
      "1::2::3",
      "192.0.2.1:80",
    ]
  ) assert.throws(() => canonicalIp(value), value);
});
