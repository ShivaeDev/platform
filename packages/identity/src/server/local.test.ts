import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { transport } from "#test/rpc/transportStory.ts";

const headers = { "content-type": "application/ndjson", host: "localhost" };
for (const address of [undefined, "203.0.113.9", "127.999.0.1"]) {
	transport.it(`rejects an unknown or non-loopback address: ${address}`, [], function* ({ guarded }) {
		expect(yield* guarded(address, headers)).toEqual({ calls: 0, status: HttpStatus.fromLiteral("Forbidden") });
	});
}
for (const address of ["127.0.0.2", "::ffff:127.0.0.1", "::1"]) {
	transport.it(`accepts a known loopback address: ${address}`, [], function* ({ guarded }) {
		expect((yield* guarded(address, headers)).status).toBe(HttpStatus.fromLiteral("NoContent"));
	});
}
transport.it("keeps loopback-only Fetch pages usable without a transport address", [], function* ({ page }) {
	expect(yield* page()).toEqual({ sameOrigin: true, status: HttpStatus.fromLiteral("NoContent") });
});
