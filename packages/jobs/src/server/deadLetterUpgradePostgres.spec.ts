import { Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#definition.ts";
import { schemaKit } from "#test/schema/kit.ts";
import { enqueuedBy, installed, installedByPgBoss, ran } from "#test/schema/traits.ts";
import { worker } from "#test/workers.ts";

const Mail = defineQueue({ name: "mail", queue: { retryLimit: 0 }, schema: Schema.Struct({}) });
const SCHEMA = "mail_jobs";

schemaKit.it(
	"schema readiness requires dead-letter resolution and becomes current after migration installs it",
	[installedByPgBoss(SCHEMA)],
	function* ({ answered, checkSchema, migrateSchema }) {
		yield* checkSchema(SCHEMA);
		expect(yield* answered()).toContain("missing dead-letter resolution trigger");

		yield* migrateSchema(SCHEMA);

		yield* checkSchema(SCHEMA);
		expect(yield* answered()).toBe("done");
	},
);

for (const installation of ["automatic migration", "schema component"] as const) {
	schemaKit.it(
		`${installation} clears copies whose original already succeeded while preserving an unretried failure`,
		[
			installedByPgBoss(SCHEMA),
			ran("app", [worker(Mail, { fails: "Delivery rejected" }, "succeeds")], { migrate: false, schema: SCHEMA }),
			enqueuedBy(Mail, {}, "mail 42", "app"),
			enqueuedBy(Mail, {}, "mail 7", "app"),
		],
		function* ({ listedNames, migrateSchema, retry, start, untilIdle, untilJob }) {
			yield* untilIdle("app");
			yield* retry("app", "mail 42");
			yield* untilJob("mail 42", "completed");
			expect((yield* listedNames("app", "dead-lettered", Mail)).toSorted()).toEqual(["copy of mail 42", "copy of mail 7"]);

			if (installation === "automatic migration") {
				yield* start("migration", [], { schema: SCHEMA });
			} else {
				yield* migrateSchema(SCHEMA);
			}

			expect(yield* listedNames("app", "dead-lettered", Mail)).toEqual(["copy of mail 7"]);
		},
	);
}

schemaKit.it(
	"an explicitly installed schema clears dead-letter copies when a runtime with migrations disabled retries successfully",
	[
		installed(SCHEMA),
		ran("app", [worker(Mail, { fails: "Delivery rejected" }, "succeeds")], { migrate: false, schema: SCHEMA }),
		enqueuedBy(Mail, {}, "mail 42", "app"),
	],
	function* ({ listedNames, retry, untilIdle, untilJob }) {
		yield* untilIdle("app");
		expect(yield* listedNames("app", "dead-lettered", Mail)).toEqual(["copy of mail 42"]);

		yield* retry("app", "mail 42");
		yield* untilJob("mail 42", "completed");

		expect(yield* listedNames("app", "dead-lettered", Mail)).toEqual([]);
	},
);
