import { expect } from "vitest";
import { transport, trustedProxy } from "#test/rpc/transportStory.ts";

for (const [peer, address, trust, answer] of [
	["the trusted proxy itself", "10.0.0.2", "10.0.0.2", "served"],
	["the trusted proxy's IPv4-mapped address", "::ffff:10.0.0.2", "10.0.0.2", "served"],
	["a neighbour of the trusted proxy", "10.0.0.3", "10.0.0.2", "forbidden"],
	["an unknown peer", undefined, "10.0.0.2", "forbidden"],
	["the first address of an IPv4 range", "100.64.0.0", "100.64.0.0/10", "served"],
	["the last address of an IPv4 range, IPv4-mapped", "::ffff:100.127.255.255", "100.64.0.0/10", "served"],
	["the address just below an IPv4 range", "100.63.255.255", "100.64.0.0/10", "forbidden"],
	["the address just above an IPv4 range", "100.128.0.0", "100.64.0.0/10", "forbidden"],
	["an unknown peer with an IPv4 range", undefined, "100.64.0.0/10", "forbidden"],
	["an address inside an IPv6 range", "2001:db8:1::ffff", "2001:db8:1::/48", "served"],
	["an address outside an IPv6 range", "2001:db8:2::", "2001:db8:1::/48", "forbidden"],
	["an uppercase, zero-padded spelling of the trusted IPv6 address", "2001:0DB8:0001:0:0:0:0:2", "2001:db8:1::2", "served"],
	["a hex IPv4-mapped address inside an IPv4 range", "::ffff:a00:2", "10.0.0.0/24", "served"],
	["a plain IPv4 address inside an IPv4-mapped range", "10.0.0.2", "::ffff:10.0.0.0/120", "served"],
	["loopback inside the IPv4-mapped loopback range", "127.0.0.1", "::ffff:127.0.0.0/104", "served"],
	["the last mapped loopback address", "::ffff:7fff:ffff", "::ffff:127.0.0.0/104", "served"],
	["the address just below the mapped loopback range", "126.255.255.255", "::ffff:127.0.0.0/104", "forbidden"],
	["the address just above the mapped loopback range", "128.0.0.0", "::ffff:127.0.0.0/104", "forbidden"],
	["an IPv6 address outside the mapped loopback range", "2001:db8::1", "::ffff:127.0.0.0/104", "forbidden"],
	["any IPv4 address inside a mapped range wider than IPv4", "203.0.113.1", "::ffff:127.0.0.0/95", "served"],
	["an IPv6 address inside a mapped range wider than IPv4", "::fffe:1234:5678", "::ffff:127.0.0.0/95", "served"],
	["an IPv6 address outside a mapped range wider than IPv4", "::fffd:1234:5678", "::ffff:127.0.0.0/95", "forbidden"],
	["any IPv4 address inside ::/64", "203.0.113.1", "::/64", "served"],
	["an IPv6 address outside ::/64", "2001:db8::1", "::/64", "forbidden"],
	["an IPv4 range member in a padded list", "10.0.0.2", " 192.0.2.1, 10.0.0.0/24, 2001:db8::/32 ", "served"],
	["an IPv6 range member in a list", "2001:db8::1", "192.0.2.1, 10.0.0.0/24, 2001:db8::/32", "served"],
	["a single listed address", "192.0.2.1", "192.0.2.1, 10.0.0.0/24, 2001:db8::/32", "served"],
	["an address in no listed entry", "192.0.2.2", "192.0.2.1, 10.0.0.0/24, 2001:db8::/32", "forbidden"],
] as const) {
	transport.it(
		`with proxy trust ${JSON.stringify(trust)}, a forwarded request from ${peer} is ${answer}`,
		[trustedProxy(trust)],
		function* ({ forwardedRequestFrom }) {
			expect(yield* forwardedRequestFrom(address)).toBe(answer);
		},
	);
}

for (const [reason, trust] of [
	["no proxy trust", undefined],
	["an empty proxy trust", ""],
	["a proxy trust that is not an address", "not-an-address"],
	["a proxy trust with an impossible prefix", "127.0.0.1/33"],
	["a proxy trust list with an invalid entry", "127.0.0.1,invalid"],
] as const) {
	transport.it(`with ${reason}, a forwarded request from loopback is forbidden`, [trustedProxy(trust)], function* ({ forwardedRequestFrom }) {
		expect(yield* forwardedRequestFrom("127.0.0.1")).toBe("forbidden");
	});
}

for (const [reason, changes] of [
	["an Origin for a different site", { origin: "https://elsewhere.example" }],
	["an Origin with the wrong scheme", { origin: "http://app.example" }],
	["two forwarded hosts", { "x-forwarded-host": "app.example, elsewhere.example" }],
	["a forwarded host with a path", { "x-forwarded-host": "app.example/path" }],
	["a forwarded host with credentials", { "x-forwarded-host": "user@app.example" }],
	["an empty forwarded host", { "x-forwarded-host": "" }],
	["a JSON body instead of the RPC serialization", { "content-type": "application/json" }],
] as const) {
	transport.it(`a request from a trusted proxy with ${reason} is forbidden`, [trustedProxy("10.0.0.0/24")], function* ({ forwardedRequestFrom }) {
		expect(yield* forwardedRequestFrom("10.0.0.2", changes)).toBe("forbidden");
	});
}

for (const [reason, protocol] of [
	["two forwarded protocols", "https, http"],
	["a forwarded protocol other than HTTP", "ftp"],
	["an empty forwarded protocol", ""],
] as const) {
	transport.it(
		`a request from a trusted proxy without an Origin and with ${reason} is forbidden`,
		[trustedProxy("10.0.0.0/24")],
		function* ({ forwardedRequestFrom }) {
			expect(yield* forwardedRequestFrom("10.0.0.2", { "x-forwarded-proto": protocol }, ["origin"])).toBe("forbidden");
		},
	);
}

transport.it("a request forwarded over plain HTTP with an explicit port is served", [trustedProxy("10.0.0.2")], function* ({ forwardedRequestFrom }) {
	expect(
		yield* forwardedRequestFrom("10.0.0.2", {
			origin: "http://app.example:8080",
			"x-forwarded-host": "app.example:8080",
			"x-forwarded-proto": "http",
		}),
	).toBe("served");
});

transport.it("a forwarded request without an Origin is served", [trustedProxy("10.0.0.2")], function* ({ forwardedRequestFrom }) {
	expect(yield* forwardedRequestFrom("10.0.0.2", {}, ["origin"])).toBe("served");
});
