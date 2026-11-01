import * as HttpStatus from "effect/http/HttpStatus";
import { expect } from "vitest";
import { browserReports } from "#test-support/browserReports.ts";

browserReports.it("the starter logs alice's browser report at Error with her user id", [], function* ({ report, recordedReports }) {
	const status = yield* report(true);

	expect(status).toBe(HttpStatus.fromLiteral("Accepted"));
	expect(yield* recordedReports()).toEqual([{ level: "Error", user: "alice" }]);
});

browserReports.it("the starter refuses signed-out browser reports without logging them", [], function* ({ report, recordedReports }) {
	const status = yield* report(false);

	expect(status).toBe(HttpStatus.fromLiteral("Unauthorized"));
	expect(yield* recordedReports()).toEqual([]);
});
