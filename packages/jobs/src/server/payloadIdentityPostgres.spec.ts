import { Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#server/definition.ts";
import { database } from "#test/postgres/database.ts";
import { enqueued, running } from "#test/postgres/traits.ts";
import { worker } from "#test/workers.ts";

const Revisions = defineQueue({
	id: ["tenant", "revision"],
	key: ["tenant"],
	name: "revisions",
	queue: { policy: "singleton" },
	schema: Schema.Struct({ note: Schema.String, revision: Schema.NumberFromString, tenant: Schema.String }),
	worker: { pollingIntervalSeconds: 0.5 },
});
const first = { note: "original", revision: 42, tenant: "alice" };

database.it(
	"the same id parts reject a second enqueue even when other payload fields change, and the worker receives the original once",
	[running("app", [Revisions]), enqueued(Revisions, first, { as: "original", underSpan: "original send" })],
	function* ({ answered, enqueue, handled, start, untilIdle }) {
		yield* enqueue("app", Revisions, { ...first, note: "changed" }, { as: "duplicate", underSpan: "duplicate send" });

		expect(yield* answered()).toBe("nothing");
		yield* start("worker", [worker(Revisions, "succeeds")]);
		yield* untilIdle("worker");

		expect(yield* handled(Revisions)).toEqual([first]);
	},
);

database.it(
	"different id parts enqueue separate revisions that share the tenant's singleton key",
	[running("app", [Revisions]), enqueued(Revisions, first, { as: "original" })],
	function* ({ answered, enqueue, job }) {
		yield* enqueue("app", Revisions, { ...first, revision: 43 }, { as: "next revision" });

		yield* outcomes([
			["enqueue answer", () => answered(), "next revision"],
			["original", () => job("original"), expect.objectContaining({ singletonKey: '[["tenant","string","alice"]]' })],
			["next revision", () => job("next revision"), expect.objectContaining({ singletonKey: '[["tenant","string","alice"]]' })],
		]);
	},
);
