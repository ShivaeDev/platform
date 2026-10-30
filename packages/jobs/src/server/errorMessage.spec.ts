import { Schema } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { queueCreationFails, runtime } from "#test/runtime/kit.ts";
import { worker } from "#test/workers.ts";

class DatabaseError extends Error {
	readonly code = "53300";
}

const Crowded = defineQueue({ name: "crowded", schema: Schema.Struct({}) });

runtime.it(
	"a failed queue registration names its operation, queue, error class and PostgreSQL code but not the original message, which it keeps",
	[queueCreationFails("PostgreSQL refuses the connection", new DatabaseError("too many connections for postgresql://jobs:secret@db/jobs"))],
	function* ({ failureMessage, start, startup }) {
		yield* start("app", [worker(Crowded, "succeeds")]);

		yield* outcomes({
			"failure message": [failureMessage("app"), "pg-boss register for queue crowded failed: DatabaseError 53300"],
			"kept original": [startup("app"), "register crowded failed with too many connections for postgresql://jobs:secret@db/jobs"],
		});
	},
);
