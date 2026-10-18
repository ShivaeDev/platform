import { Effect, Redacted, Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#definition.ts";
import { PgBossError } from "#error.ts";
import { boss } from "#test/boss.ts";
import { scriptedClient } from "#test/scriptedClient.ts";

boss.it("names the queue and PostgreSQL code of failed registration without its original message", [], function* ({ boot }) {
	class DatabaseError extends Error {
		readonly code = "53300";
	}
	const failure = new DatabaseError("too many connections for postgresql://jobs:secret@db/jobs");
	const client = scriptedClient({ createQueue: () => Promise.reject(failure) });
	const Queue = defineQueue({ name: "crowded", schema: Schema.Struct({}) });
	const error = yield* Effect.flip(boot([Queue.handle(() => Effect.void)], { clientFactory: () => client }));
	if (!(error instanceof PgBossError)) {
		throw error;
	}
	expect(error).toMatchObject({ operation: "register", queue: "crowded" });
	expect(error.message).toBe("pg-boss register for queue crowded failed: DatabaseError 53300");
	expect(Redacted.value(error.original)).toBe(failure);
});
