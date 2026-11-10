import { Redacted, Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#server/definition.ts";
import { database } from "#test/postgres/database.ts";
import { engineUnavailable, enqueued, running } from "#test/postgres/traits.ts";

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
