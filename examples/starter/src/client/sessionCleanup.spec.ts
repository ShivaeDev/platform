import { expect } from "vitest";
import { sessionCleanup } from "#test-support/sessionCleanup.ts";

sessionCleanup.it("ends a DOM file without unhandled errors from delayed session cleanup", [], function* ({ run }) {
	const result = yield* run();
	expect(result.errors).toEqual([]);
	expect(result.tests).toMatchObject([{ name: "leaves the real session atom after a null-session response", result: { state: "passed" } }]);
});
