import { expect, it } from "vitest";
import { trustedProxyPeer } from "#rpc-server/local.ts";
import { forwarded, transport, trustedProxy } from "#test/rpc/transportStory.ts";

transport.it("trusts forwarded authority only from the configured transport peer", [trustedProxy("10.0.0.2")], function* ({ guarded }) {
	expect(yield* guarded("10.0.0.2")).toEqual({ calls: 1, status: 204 });
	expect(yield* guarded("::ffff:10.0.0.2")).toEqual({ calls: 1, status: 204 });
	expect(yield* guarded("10.0.0.2", "")).toEqual({ calls: 0, status: 403 });
	expect(yield* guarded("10.0.0.3")).toEqual({ calls: 0, status: 403 });
	expect(yield* guarded(undefined)).toEqual({ calls: 0, status: 403 });
});
for (const [address, trust, accepted] of [
	["100.64.0.0", "100.64.0.0/10", true],
	["::ffff:100.127.255.255", "100.64.0.0/10", true],
	["100.63.255.255", "100.64.0.0/10", false],
	["100.128.0.0", "100.64.0.0/10", false],
	["2001:db8:1::ffff", "2001:db8:1::/48", true],
	["2001:db8:2::", "2001:db8:1::/48", false],
	["2001:0DB8:0001:0:0:0:0:2", "2001:db8:1::2", true],
	["::ffff:a00:2", "10.0.0.0/24", true],
	["10.0.0.2", "::ffff:10.0.0.0/120", true],
	["127.0.0.1", "::ffff:127.0.0.0/104", true],
	["::ffff:7fff:ffff", "::ffff:127.0.0.0/104", true],
	["126.255.255.255", "::ffff:127.0.0.0/104", false],
	["128.0.0.0", "::ffff:127.0.0.0/104", false],
	["2001:db8::1", "::ffff:127.0.0.0/104", false],
	["203.0.113.1", "::ffff:127.0.0.0/95", true],
	["::fffe:1234:5678", "::ffff:127.0.0.0/95", true],
	["::fffd:1234:5678", "::ffff:127.0.0.0/95", false],
	["203.0.113.1", "::/64", true],
	["2001:db8::1", "::/64", false],
	["10.0.0.2", " 192.0.2.1, 10.0.0.0/24, 2001:db8::/32 ", true],
	["2001:db8::1", "192.0.2.1, 10.0.0.0/24, 2001:db8::/32", true],
	["192.0.2.1", "192.0.2.1, 10.0.0.0/24, 2001:db8::/32", true],
	["192.0.2.2", "192.0.2.1, 10.0.0.0/24, 2001:db8::/32", false],
	[undefined, "100.64.0.0/10", false],
] as const) {
	transport.it(`matches transport peer ${address} against ${trust}`, [trustedProxy(trust)], function* ({ guarded }) {
		expect(yield* guarded(address)).toEqual({ calls: accepted ? 1 : 0, status: accepted ? 204 : 403 });
		if (address !== undefined) {
			expect(trustedProxyPeer(trust)(address)).toBe(accepted);
		}
	});
}
it.each([undefined, "", "not-an-address", "127.0.0.1/33", "127.0.0.1,invalid"])("matches no peer with absent or malformed trust: %s", (trust) => {
	expect(trustedProxyPeer(trust)("127.0.0.1")).toBe(false);
});
for (const headers of [
	{ origin: "https://elsewhere.example" },
	{ origin: "http://app.example" },
	{ "x-forwarded-host": "app.example, elsewhere.example" },
	{ "x-forwarded-host": "app.example/path" },
	{ "x-forwarded-host": "user@app.example" },
	{ "x-forwarded-host": "" },
	{ "x-forwarded-proto": "https, http" },
	{ "x-forwarded-proto": "ftp" },
	{ "x-forwarded-proto": "" },
	{ "content-type": "application/json" },
]) {
	transport.it(`refuses invalid forwarded request ${JSON.stringify(headers)}`, [trustedProxy("10.0.0.0/24")], function* ({ guarded }) {
		expect(yield* guarded("10.0.0.2", undefined, { ...forwarded, ...headers })).toEqual({ calls: 0, status: 403 });
	});
}
transport.it("accepts HTTP forwarding, explicit ports and absent Origin", [trustedProxy("10.0.0.2")], function* ({ guarded }) {
	expect(
		yield* guarded("10.0.0.2", undefined, {
			...forwarded,
			origin: "http://app.example:8080",
			"x-forwarded-host": "app.example:8080",
			"x-forwarded-proto": "http",
		}),
	).toEqual({ calls: 1, status: 204 });
	const { origin: _, ...headers } = forwarded;
	expect(yield* guarded("10.0.0.2", undefined, headers)).toEqual({ calls: 1, status: 204 });
});
