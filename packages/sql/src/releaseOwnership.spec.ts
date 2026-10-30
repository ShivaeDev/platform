import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { applied, migrationRuns } from "#test/migrationRuns.ts";

migrationRuns.it(
	"a run with a release records it only after every schema component has applied",
	[],
	function* ({ migrate, recordedRelease, releasesSeenByComponents }) {
		yield* migrate(["1_record_first"], { components: ["release watcher"], release: "first" });

		yield* outcomes({
			"recorded release": [recordedRelease(), "first"],
			"release seen by the component": [releasesSeenByComponents(), ["none"]],
		});
	},
);

migrationRuns.it(
	"the release marker keeps one row with the release and a timestamptz of the run that recorded it",
	[applied(["1_record_first"], { release: "first" })],
	function* ({ migrate, releaseMarker }) {
		yield* migrate(["1_record_first"], { release: "second" });

		expect(yield* releaseMarker()).toEqual({ columnType: "timestamp with time zone", recordedDuringTheRuns: true, release: "second", rows: 1 });
	},
);

migrationRuns.it(
	"readiness reports a different recorded release as a pending database release component",
	[applied(["1_record_first"], { release: "first" })],
	function* ({ pendingWork }) {
		const pending = yield* pendingWork(["1_record_first"], { release: "second" });

		expect(pending).toEqual({ components: [{ detail: "Expected release second; recorded first", name: "database release" }], migrations: [] });
	},
);

migrationRuns.it(
	"a run without a release creates no release or worker tables, and readiness for a release then reports none recorded",
	[],
	function* ({ existingTables, migrate, pendingWork }) {
		yield* migrate(["1_create_orders"]);

		yield* outcomes({
			"existing tables": [existingTables(), ["ledger", "orders"]],
			"pending work for release first": [
				pendingWork(["1_create_orders"], { release: "first" }),
				{ components: [{ detail: "Expected release first; recorded none", name: "database release" }], migrations: [] },
			],
		});
	},
);
