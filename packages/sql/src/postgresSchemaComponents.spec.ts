import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { applied, migrationRuns, orderIndexDropped } from "#test/migrationRuns.ts";

migrationRuns.it(
	"readiness names pending migrations and pending schema components together in one error",
	[],
	function* ({ assertReady, pendingWork, verdicts }) {
		yield* assertReady(["1_create_orders"], { components: ["order index"] });

		yield* outcomes({
			"pending work": [
				pendingWork(["1_create_orders"], { components: ["order index"] }),
				{ components: [{ detail: "index missing", name: "order index" }], migrations: [{ id: 1, name: "create_orders" }] },
			],
			verdicts: [
				verdicts(),
				[
					"failed with a bad migration state: Database migrations are not current: migration 1 (create_orders); component order index: index missing. Run the deployment migration command.",
				],
			],
		});
	},
);

migrationRuns.it(
	"readiness fails on a pending schema component even when every migration is applied",
	[applied(["1_create_orders"], { components: ["order index"] }), orderIndexDropped()],
	function* ({ assertReady }) {
		const verdict = yield* assertReady(["1_create_orders"], { components: ["order index"] });

		expect(verdict).toBe(
			"failed with a bad migration state: Database migrations are not current: component order index: index missing. Run the deployment migration command.",
		);
	},
);

migrationRuns.it(
	"a run applies its schema components outside the ledger transaction once it commits",
	[],
	function* ({ assertReady, migrate, runs }) {
		yield* migrate(["1_create_orders"], { components: ["order index"] });

		yield* outcomes({
			readiness: [assertReady(["1_create_orders"], { components: ["order index"] }), "ready"],
			runs: [runs(), [[[1, "create_orders"]]]],
		});
	},
);

migrationRuns.it(
	"a run with no pending migrations applies a pending schema component again",
	[applied(["1_create_orders"], { components: ["order index"] }), orderIndexDropped()],
	function* ({ migrate, pendingWork, runs }) {
		expect(yield* pendingWork(["1_create_orders"], { components: ["order index"] })).toEqual({
			components: [{ detail: "index missing", name: "order index" }],
			migrations: [],
		});

		yield* migrate(["1_create_orders"], { components: ["order index"] });

		yield* outcomes({
			"pending work": [pendingWork(["1_create_orders"], { components: ["order index"] }), { components: [], migrations: [] }],
			runs: [runs(), [[]]],
		});
	},
);

migrationRuns.it(
	"a failed schema component fails the run with its name and cause and leaves the ledger committed",
	[],
	function* ({ ledger, migrate, runs }) {
		yield* migrate(["1_create_orders"], { components: ["failing jobs storage"] });

		yield* outcomes({
			ledger: [ledger(), [[1, "create_orders"]]],
			runs: [runs(), ["failed with a failed migration: Schema component failing jobs storage failed., caused by jobs storage unavailable"]],
		});
	},
);
