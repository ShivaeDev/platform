import { expect } from "vitest";
import { postgresStory } from "#test/postgresStory.ts";

postgresStory.it(
	"passes the typed database facade and Vitest context to the generator",
	[],
	function* ({ testing }) {
		expect(yield* testing("passes the typed database facade and Vitest context to the generator")).toMatchObject({
			errors: [],
			state: "passed",
		});
	},
	{ clock: "live", timeout: 30_000 },
);

postgresStory.it(
	"does not retain successful writes from the previous test",
	[],
	function* ({ testing }) {
		expect(yield* testing("does not retain successful writes from the previous test")).toMatchObject({
			errors: [],
			state: "passed",
		});
	},
	{ clock: "live", timeout: 30_000 },
);

postgresStory.it(
	"supports table-driven rollback tests (1)",
	[],
	function* ({ testing }) {
		expect(yield* testing("supports table-driven rollback tests")).toMatchObject({ errors: [], state: "passed" });
	},
	{ clock: "live", timeout: 30_000 },
);

postgresStory.it(
	"supports table-driven rollback tests (2)",
	[],
	function* ({ testing }) {
		expect(yield* testing("supports table-driven rollback tests", 1)).toMatchObject({ errors: [], state: "passed" });
	},
	{ clock: "live", timeout: 30_000 },
);

postgresStory.it(
	"rolls back a failed Effect",
	[],
	function* ({ testing }) {
		expect(yield* testing("rolls back a failed Effect")).toMatchObject({ errors: [], state: "passed" });
	},
	{ clock: "live", timeout: 30_000 },
);

postgresStory.it(
	"does not retain writes from an expected failure",
	[],
	function* ({ testing }) {
		expect(yield* testing("does not retain writes from an expected failure")).toMatchObject({
			errors: [],
			state: "passed",
		});
	},
	{ clock: "live", timeout: 30_000 },
);

postgresStory.it(
	"exposes the framework-neutral forced-rollback primitive",
	[],
	function* ({ testing }) {
		expect(yield* testing("exposes the framework-neutral forced-rollback primitive")).toMatchObject({
			errors: [],
			state: "passed",
		});
	},
	{ clock: "live", timeout: 30_000 },
);
