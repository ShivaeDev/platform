import { Schema } from "effect";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { running } from "#test/postgres/traits.ts";

const Notes = defineQueue({ name: "notes", schema: Schema.Struct({ id: Schema.NumberFromString }) });

database.it(
	"an administrator terminating the runtime's idle connection is logged at Debug and the next enqueue runs on a new connection",
	[running("app", [Notes], { "application_name": "app", max: 1, schedule: false, supervise: false })],
	function* ({ answered, connectionAfterwards, enqueue, logged, terminateIdleConnections, untilLogged }) {
		yield* terminateIdleConnections("app");
		yield* untilLogged("administrator command");
		yield* enqueue("app", Notes, { id: 1 }, { as: "note 1" });

		yield* outcomes({
			"connection": [connectionAfterwards("app"), "a new connection"],
			"enqueue answer": [answered(), "note 1"],
			"logged": [
				logged("app"),
				[{ level: "Debug", message: { event: "pg_boss_error", message: "terminating connection due to administrator command" } }],
			],
		});
	},
);
