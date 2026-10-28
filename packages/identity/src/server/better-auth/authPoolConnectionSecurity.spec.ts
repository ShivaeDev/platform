import { expect } from "vitest";
import { authPool, openAuthPool } from "#test/better-auth/pool.ts";

authPool.it("with sslmode unset, an auth query connects without TLS", [openAuthPool({ sslmode: "unset" })], function* ({ query, queryTransport }) {
	yield* query();

	expect(yield* queryTransport()).toBe("plain");
});

authPool.it(
	"with sslmode=require, an auth query uses TLS, or is refused when the server offers none",
	[openAuthPool({ sslmode: "require" })],
	function* ({ query, queryTransport, serverOffersTls }) {
		const required = (yield* serverOffersTls()) ? "TLS" : "refused because the server offers no TLS";

		yield* query();

		expect(yield* queryTransport()).toBe(required);
	},
);
