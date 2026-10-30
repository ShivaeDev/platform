import { expect } from "vitest";
import { configuredOrigins, originPolicy } from "#test/rpc/originPolicy.ts";

const forwarded = { host: "internal.test", origin: "https://app.example", "x-forwarded-host": "app.example", "x-forwarded-proto": "https" };

for (const [claim, peer, changes, answer] of [
	["accepts forwarded HTTPS from a trusted proxy", "10.0.0.2", {}, "accepted"],
	["refuses forwarded HTTPS from an untrusted peer", "10.0.0.3", {}, "Forbidden"],
	["refuses forwarded HTTPS without a transport peer", undefined, {}, "Forbidden"],
	["refuses a foreign origin from a trusted proxy", "10.0.0.2", { origin: "https://foreign.example" }, "Forbidden"],
	["refuses an HTTP origin for an HTTPS authority", "10.0.0.2", { origin: "http://app.example" }, "Forbidden"],
	["refuses an opaque origin", "10.0.0.2", { origin: "null" }, "Forbidden"],
	["refuses a malformed forwarded authority", "10.0.0.2", { "x-forwarded-host": "app.example, foreign.example" }, "Forbidden"],
	["accepts an explicit HTTPS port", "10.0.0.2", { origin: "https://app.example:8443", "x-forwarded-host": "app.example:8443" }, "accepted"],
] as const) {
	originPolicy.it(`same-origin session trust ${claim}`, [], function* ({ call }) {
		expect(yield* call({ ...forwarded, ...changes }, peer)).toBe(answer);
	});
}

originPolicy.it("same-origin session trust accepts direct loopback HTTP", [], function* ({ call }) {
	expect(yield* call({ host: "localhost:3000", origin: "http://localhost:3000" }, "127.0.0.1")).toBe("accepted");
});

originPolicy.it("same-origin session trust refuses a missing origin when configured to reject it", [], function* ({ call }) {
	expect(yield* call({ host: "localhost:3000" }, "127.0.0.1")).toBe("Forbidden");
});

originPolicy.it("RPC message headers cannot supply a trusted forwarded authority", [], function* ({ call }) {
	expect(yield* call({ host: "internal.test", origin: "https://app.example" }, "10.0.0.2", forwarded)).toBe("Forbidden");
});

originPolicy.it(
	"same-origin session trust refuses forwarded HTTPS without configured proxy trust",
	[configuredOrigins({ allow: [], missing: "allow", sameOrigin: {} })],
	function* ({ call }) {
		expect(yield* call(forwarded, "10.0.0.2")).toBe("Forbidden");
	},
);

originPolicy.it(
	"an explicit public origin keeps same-origin fallback disabled",
	[configuredOrigins({ allow: ["https://public.example"], missing: "allow" })],
	function* ({ call }) {
		expect(yield* call(forwarded, "10.0.0.2")).toBe("Forbidden");
	},
);
