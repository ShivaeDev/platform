import { expect } from "vitest";
import { transport } from "#test/rpc/transportStory.ts";

for (const [peer, address] of [
	["no transport address", undefined],
	["a public address", "203.0.113.9"],
	["a malformed loopback address", "127.999.0.1"],
] as const) {
	transport.it(`a same-origin localhost RPC request from ${peer} is forbidden`, [], function* ({ localRequestFrom }) {
		expect(yield* localRequestFrom(address)).toBe("forbidden");
	});
}

for (const [peer, address] of [
	["another IPv4 loopback address", "127.0.0.2"],
	["the IPv4-mapped loopback address", "::ffff:127.0.0.1"],
	["the IPv6 loopback address", "::1"],
] as const) {
	transport.it(`a same-origin localhost RPC request from ${peer} is served`, [], function* ({ localRequestFrom }) {
		expect(yield* localRequestFrom(address)).toBe("served");
	});
}

transport.it("a loopback-only Fetch page is served even without a transport address", [], function* ({ loopbackPageWithoutAddress }) {
	expect(yield* loopbackPageWithoutAddress()).toBe("served");
});

transport.it("a Fetch page request without an Origin counts as same-origin", [], function* ({ pageCountsAsSameOrigin }) {
	expect(yield* pageCountsAsSameOrigin({})).toBe(true);
});
