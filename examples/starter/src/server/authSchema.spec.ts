import { Effect } from "effect";
import { SqlClient } from "effect/sql";
import { expect } from "vitest";
import { deployment } from "#test-support/deployment.ts";

deployment.it("auth still reports a missing column when the migration ledger is current", [], function* ({ migrate, startProcess }) {
	const sql = yield* SqlClient.SqlClient;
	expect(yield* migrate()).toBe(0);
	yield* sql`alter table "user" drop column image`;
	const web = yield* startProcess("web");
	const address = yield* web.ready;
	const response = yield* Effect.promise(() => fetch(`${address}/api/auth/get-session`));
	expect(response.status).toBe(503);
	yield* Effect.promise(() => expect.poll(() => web.errors.join("\n")).toContain("Database schema mismatch"));
	expect(web.errors.join("\n")).toContain("Missing columns");
	expect(web.errors.join("\n")).toContain("user.image");
});
