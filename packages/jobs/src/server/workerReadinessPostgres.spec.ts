import { Effect, Schema } from "effect";
import { expect } from "vitest";
import { defineQueue } from "#server/definition.ts";
import { database } from "#test/postgres/database.ts";
import { releaseHeld } from "#test/postgres/releaseTraits.ts";
import { running } from "#test/postgres/traits.ts";
import { worker } from "#test/workers.ts";

const Payload = Schema.Struct({ id: Schema.Number });
const First = defineQueue({ name: "ready-first", schema: Payload, worker: { pollingIntervalSeconds: 0.5 } });
const Second = defineQueue({ name: "ready-second", schema: Payload, worker: { pollingIntervalSeconds: 0.5 } });
const clientCacheKey = Symbol("shared readiness client");

function readinessLines(lines: readonly { readonly message: unknown }[]) {
	return lines.filter(({ message }) => message === "Worker ready to take jobs");
}

database.it(
	"a runtime with workers logs once that it is ready to take jobs as it starts",
	[running("app", [worker(First, "succeeds"), worker(Second, "succeeds")])],
	function* ({ logged }) {
		expect(yield* logged("app")).toEqual([{ level: "Info", message: "Worker ready to take jobs" }]);
	},
);

database.it("a runtime with only queue definitions logs no readiness", [running("producer", [First, Second])], function* ({ logged }) {
	expect(yield* logged("producer")).toEqual([]);
});

database.it(
	"two jobs Layers on one shared client log their readiness once between them",
	[running("notes", [worker(First, "succeeds")], { clientCacheKey }), running("tasks", [worker(Second, "succeeds")], { clientCacheKey })],
	function* ({ logged }) {
		expect(yield* Effect.map(logged(), readinessLines)).toEqual([{ level: "Info", message: "Worker ready to take jobs" }]);
	},
);

database.it(
	"a runtime started while another deployment holds the release logs its readiness when the release returns, and not again when it resumes later",
	[releaseHeld("another deployment"), running("app", [worker(First, "succeeds")])],
	function* ({ handOverRelease, takeBackRelease, timeline, untilHandedOver }) {
		expect(yield* timeline("app")).toEqual([]);

		yield* takeBackRelease();
		yield* handOverRelease();
		yield* untilHandedOver();
		yield* takeBackRelease();

		expect(yield* timeline("app")).toEqual([
			"app: Worker ready to take jobs",
			"app: Workers paused for another database release",
			"app: Workers resumed for database release",
		]);
	},
);
