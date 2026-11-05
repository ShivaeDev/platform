import { expect } from "@effect/vitest";
import { Redacted, Schema } from "effect";
import { defineQueue } from "@shivaedev/jobs/server/definition.ts";
import { database } from "#test/jobs/postgres/database.ts";
import { engineUnavailable, enqueued, running } from "#test/jobs/postgres/traits.ts";

const Expiring = defineQueue({ name: "expiring", schema: Schema.Struct({}) });

database.it(
	"an unavailable engine retains its expiry refusal under a tagged testing error",
	[running("app", [Expiring], { schedule: false, supervise: false }), enqueued(Expiring, {}, { as: "job" }), engineUnavailable()],
	function* ({ expiryFailure }) {
		const error = yield* expiryFailure("job");

		expect(error).toMatchObject({ _tag: "PgBossTestingError", operation: "expireAttempt", queue: "expiring" });
		expect(Redacted.value(error.original)).toBeInstanceOf(Error);
	},
);
