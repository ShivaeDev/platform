import { Effect, Layer, Redacted, Schema } from "effect";
import { expect, it } from "vitest";
import { defineQueue } from "#definition.ts";
import { PgBossError } from "#error.ts";
import { makePgBoss } from "#service.ts";
import { constructorOptions } from "#test/fakeClient.ts";
import { scriptedClient } from "#test/scriptedClient.ts";

it("names the queue and the PostgreSQL code of a failed registration without its original message", async () => {
	class DatabaseError extends Error {
		readonly code = "53300";
	}
	const failure = new DatabaseError("too many connections for postgresql://jobs:secret@db/jobs");
	const client = scriptedClient({
		createQueue: () => Promise.reject(failure),
		off: () => undefined,
		on: () => undefined,
		start: async () => undefined,
		stop: async () => undefined,
	});
	const Queue = defineQueue({ name: "crowded", schema: Schema.Struct({}) });
	const Jobs = makePgBoss("@test/RegisterFailureJobs");
	const error = await Effect.runPromise(
		Effect.flip(
			Effect.scoped(Layer.build(Jobs.layer({ ...constructorOptions, clientFactory: () => client, jobs: [Queue.handle(() => Effect.void)] }))),
		),
	);
	if (!(error instanceof PgBossError)) {
		throw error;
	}
	expect(error).toMatchObject({ operation: "register", queue: "crowded" });
	expect(error.message).toBe("pg-boss register for queue crowded failed: DatabaseError 53300");
	expect(Redacted.value(error.original)).toBe(failure);
});
