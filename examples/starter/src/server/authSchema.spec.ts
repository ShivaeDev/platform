import { Effect } from "effect";
import { expect } from "vitest";
import { deployment } from "#test-support/deployment.ts";

deployment.it("auth still reports a missing column when the migration ledger is current", [], function* ({ migrate, startProcess, dropAuthColumn }) {
	expect(yield* migrate()).toBe(0);
	yield* dropAuthColumn;
	const web = yield* startProcess("web");
	const address = yield* web.ready;
	const response = yield* Effect.promise(() => fetch(`${address}/api/auth/get-session`));
	expect(response.status).toBe(503);
	yield* Effect.promise(() => expect.poll(() => web.errors.join("\n")).toContain("Database schema mismatch"));
	expect(web.errors.join("\n")).toContain("Missing columns");
	expect(web.errors.join("\n")).toContain("user.image");
});
