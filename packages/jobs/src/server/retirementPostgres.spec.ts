import { Schema } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { defineQueue } from "#definition.ts";
import { database } from "#test/postgres/database.ts";
import { releaseHeld } from "#test/postgres/releaseTraits.ts";
import { running, stoppedAfterwards } from "#test/postgres/traits.ts";
import { scheduled } from "#test/workers.ts";
import { defineSchedule } from "./defineSchedule.ts";

const Legacy = defineQueue({ name: "legacy", schema: Schema.Struct({ id: Schema.Number }) });
const Current = defineQueue({ name: "current", schema: Legacy.schema });
const Nightly = defineSchedule({ cron: "17 3 * * *", name: "old-nightly", schedule: { key: "nightly" } });
const previous = running("previous", [Legacy, scheduled(Nightly, "succeeds")], { schedule: false });
const stopped = stoppedAfterwards("previous");

database.it(
	"worker startup removes retired queues and keyed schedules while keeping their dead letters and registering current queues",
	[previous, stopped],
	function* ({ start, startup, storedQueue, storedSchedules }) {
		yield* outcomes([
			["old queue", () => storedQueue("legacy"), { name: "legacy" }],
			["old schedule", () => storedSchedules("old-nightly"), [{ name: "old-nightly" }]],
		]);

		yield* start("current", [Current], { retired: ["legacy", "old-nightly"] });

		yield* outcomes([
			["current queue", () => storedQueue("current"), expect.objectContaining({ name: "current" })],
			["current runtime", () => startup("current"), "started"],
			["retained dead letters", () => storedQueue("legacy-dlq"), expect.objectContaining({ name: "legacy-dlq" })],
			["retired queue", () => storedQueue("legacy"), "missing"],
			["retired schedule queue", () => storedQueue("old-nightly"), "missing"],
			["retired schedules", () => storedSchedules("old-nightly"), []],
		]);
	},
);

database.it(
	"a later worker startup can retire the same absent names again",
	[previous, stopped],
	function* ({ start, startup, stop, storedQueue, storedSchedules }) {
		yield* start("first cleanup", [], { retired: ["legacy", "old-nightly"] });
		yield* stop("first cleanup");
		expect(yield* storedQueue("legacy")).toBe("missing");

		yield* start("second cleanup", [], { retired: ["legacy", "old-nightly"] });

		yield* outcomes([
			["retired queue", () => storedQueue("legacy"), "missing"],
			["retired schedule", () => storedSchedules("old-nightly"), []],
			["second startup", () => startup("second cleanup"), "started"],
		]);
	},
);

for (const name of ["current", "current-dlq"]) {
	database.it(
		`startup refuses to retire ${name}, needed by a current registration, before deleting any queue`,
		[previous, stopped],
		function* ({ start, startup, storedQueue }) {
			expect(yield* storedQueue("legacy")).toMatchObject({ name: "legacy" });

			yield* start("conflicting", [Current], { retired: ["legacy", name] });

			yield* outcomes([
				[
					"startup failure",
					() => startup("conflicting"),
					expect.stringContaining("Retired queues must not be registered or used as dead-letter queues"),
				],
				["untouched legacy queue", () => storedQueue("legacy"), expect.objectContaining({ name: "legacy" })],
			]);
		},
	);
}

database.it(
	"a cleanup-only runtime waits for its database release before retiring queues",
	[releaseHeld("another deployment"), running("previous", [Legacy]), stopped],
	function* ({ start, storedQueue, takeBackRelease }) {
		yield* start("cleanup", [], { retired: ["legacy"] });
		expect(yield* storedQueue("legacy")).toMatchObject({ name: "legacy" });

		yield* takeBackRelease();

		expect(yield* storedQueue("legacy")).toBe("missing");
	},
);
