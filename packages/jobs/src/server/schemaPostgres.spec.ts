import { Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { schemaKit } from "#test/schema/kit.ts";
import { brokenSchema, enqueuedBy, installed, installedTemplate, ran, rolledBackTo, stopped } from "#test/schema/traits.ts";
import { worker } from "#test/workers.ts";

const TWO_VERSIONS_BEHIND = 44;

const Installed = defineQueue({ name: "installed", schema: Schema.Struct({ value: Schema.Number }), worker: { pollingIntervalSeconds: 0.5 } });

schemaKit.it(
	"a runtime on a clone of the installed template runs a deferred job without migrating",
	[installedTemplate],
	function* ({ attempts, enqueue, job, start, storedRows, untilJob }) {
		yield* outcomes({
			instances: [storedRows("jobs_test", "instance"), 0],
			queues: [storedRows("jobs_test", "queue"), 0],
			schedules: [storedRows("jobs_test", "schedule"), 0],
		});

		yield* start("app", [worker(Installed, { defers: "Next fetch", until: "now" }, "succeeds")], { migrate: false, schema: "jobs_test" });
		yield* enqueue("app", Installed, { value: 42 }, { as: "job" });
		yield* untilJob("job", "completed");

		yield* outcomes({
			attempts: [attempts(Installed), ["job", "job"]],
			job: [job("job"), expect.objectContaining({ data: { value: 42 }, retryCount: 0, state: "completed" })],
		});
	},
);

schemaKit.it("a runtime with migrations disabled cannot start in an empty database", [], function* ({ start, startup }) {
	expect(yield* startup("app")).toBe("never started");

	yield* start("app", [], { controller: "none", migrate: false });

	expect(yield* startup("app")).toMatch(/^start failed with /u);
});

const Preserved = defineQueue({ name: "preserved", schema: Schema.Struct({ value: Schema.Number }), worker: { pollingIntervalSeconds: 0.5 } });

schemaKit.it(
	"installing the default schema again keeps the jobs already queued",
	[
		installed(),
		ran("producer", [Preserved], { controller: "none", migrate: false }),
		enqueuedBy(Preserved, { value: 7 }, "job", "producer"),
		stopped("producer"),
	],
	function* ({ attempts, installSchema, job, start, untilJob }) {
		expect(yield* job("job")).toMatchObject({ state: "created" });

		yield* installSchema();
		yield* start("app", [worker(Preserved, "succeeds")], { migrate: false });
		yield* untilJob("job", "completed");

		expect(yield* attempts(Preserved)).toEqual(["job"]);
	},
);

const Partitioned = defineQueue({ name: "partitioned", queue: { partition: true }, schema: Schema.Struct({}) });

schemaKit.it(
	"upgrading a schema two versions behind builds its concurrent partition indexes",
	[
		installed("jobs_test"),
		ran("producer", [Partitioned], { controller: "none", migrate: false, schema: "jobs_test" }),
		stopped("producer"),
		rolledBackTo("jobs_test", TWO_VERSIONS_BEHIND),
	],
	function* ({ indexes, installSchema, schemaVersion }) {
		expect(yield* schemaVersion("jobs_test")).toBe(TWO_VERSIONS_BEHIND);

		yield* installSchema("jobs_test");

		yield* outcomes({
			indexes: [
				indexes("jobs_test", "i13$"),
				[
					{ index: "jobs_test.job_common_i13", table: "jobs_test.job_common", valid: true },
					{ index: "jobs_test.partition_i13", table: "jobs_test.partition", valid: true },
				],
			],
			version: [schemaVersion("jobs_test"), 46],
		});
	},
);

for (const { broken, schema } of [
	{ broken: [], schema: "invalid.schema" },
	{ broken: [brokenSchema("broken")], schema: "broken" },
]) {
	schemaKit.it(
		`a failed install into ${schema} answers with a typed install error and leaves the connection usable`,
		broken,
		function* ({ answered, checkSchema, installSchema }) {
			yield* installSchema(schema);
			expect(yield* answered()).toMatch(/^install failed with /u);

			yield* installSchema();

			yield* checkSchema();
			expect(yield* answered()).toBe("done");
		},
	);
}
