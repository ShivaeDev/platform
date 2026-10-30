import { Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { schemaKit } from "#test/schema/kit.ts";
import { enqueuedBy, installed, ran, rolledBackTo, stopped } from "#test/schema/traits.ts";
import { worker } from "#test/workers.ts";

const Upgraded = defineQueue({
	name: "upgrade",
	queue: { partition: true },
	schema: Schema.Struct({ value: Schema.Number }),
	worker: { pollingIntervalSeconds: 0.5 },
});

const oneVersionBehind = [
	installed("jobs_test"),
	ran("producer", [Upgraded], { controller: "none", migrate: false, schema: "jobs_test" }),
	enqueuedBy(Upgraded, { value: 42 }, "job", "producer"),
	stopped("producer"),
	rolledBackTo("jobs_test", 45),
];

schemaKit.it(
	"the schema component upgrades a schema one version behind and builds valid indexes",
	oneVersionBehind,
	function* ({ answered, checkSchema, indexes, migrateSchema, schemaVersion }) {
		yield* checkSchema("jobs_test");
		expect(yield* answered()).toEqual(expect.stringContaining("installed version 45, required version 46"));

		yield* migrateSchema("jobs_test");

		yield* checkSchema("jobs_test");
		yield* outcomes({
			check: [answered(), "done"],
			indexes: [indexes("jobs_test", "_i1[4-7]$"), Array.from({ length: 8 }, () => expect.objectContaining({ valid: true }))],
			version: [schemaVersion("jobs_test"), 46],
		});
	},
);

schemaKit.it(
	"work queued before the schema component upgrade runs once a worker starts after it",
	oneVersionBehind,
	function* ({ attempts, migrateSchema, start, untilJob }) {
		yield* migrateSchema("jobs_test");
		expect(yield* attempts(Upgraded)).toEqual([]);

		yield* start("app", [worker(Upgraded, "succeeds")], { migrate: false, schema: "jobs_test" });
		yield* untilJob("job", "completed");

		expect(yield* attempts(Upgraded)).toEqual(["job"]);
	},
);
