import { expect } from "vitest";
import { readiness } from "#test/readiness.ts";

for (const held of ["services", "handlers", "routes"] as const) {
	readiness.it(
		`refuses TCP connections until ${held} are constructed and answers its first request`,
		[],
		function* ({ start, constructionHeld, connection, releaseConstruction, waitForListening, firstResponse }) {
			const startup = yield* start(held);
			yield* constructionHeld;
			expect(yield* connection).toBe("ECONNREFUSED");
			yield* releaseConstruction;
			yield* waitForListening(startup);
			expect(yield* firstResponse).toEqual({ body: "Ready", status: 200 });
		},
	);
}
