import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { applied, ledgerLacksNameColumn, ledgerRenames, migrationRuns } from "#test/migrationRuns.ts";

const NOT_CURRENT = "failed with a bad migration state: Database migrations are not current";

migrationRuns.it(
	"readiness on a missing ledger reports every migration pending, without running them or creating the ledger",
	[],
	function* ({ assertReady, bodiesRun, existingTables, pendingWork, verdicts }) {
		yield* assertReady(["1_record_first", "2_record_second"]);

		yield* outcomes({
			"bodies run": [bodiesRun(), []],
			"existing tables": [existingTables(), []],
			"pending work": [
				pendingWork(["1_record_first", "2_record_second"]),
				{
					components: [],
					migrations: [
						{ id: 1, name: "record_first" },
						{ id: 2, name: "record_second" },
					],
				},
			],
			verdicts: [verdicts(), [`${NOT_CURRENT}: migration 1 (record_first); migration 2 (record_second). Run the deployment migration command.`]],
		});
	},
);

migrationRuns.it(
	"readiness reports the migrations above a partial ledger as pending, without running them",
	[applied(["1_record_first"])],
	function* ({ assertReady, bodiesRun, pendingWork, verdicts }) {
		yield* assertReady(["1_record_first", "2_record_second"]);

		yield* outcomes({
			"bodies run": [bodiesRun(), []],
			"pending work": [pendingWork(["1_record_first", "2_record_second"]), { components: [], migrations: [{ id: 2, name: "record_second" }] }],
			verdicts: [verdicts(), [`${NOT_CURRENT}: migration 2 (record_second). Run the deployment migration command.`]],
		});
	},
);

migrationRuns.it(
	"readiness accepts a ledger with later migrations than the loader, so an older release can start during a rolling deployment",
	[applied(["1_record_first", "2_record_second"])],
	function* ({ assertReady }) {
		const verdict = yield* assertReady(["1_record_first"]);

		expect(verdict).toBe("ready");
	},
);

migrationRuns.it(
	"readiness reports a migration whose recorded name differs as pending",
	[applied(["1_record_first"]), ledgerRenames(1, "different")],
	function* ({ assertReady, pendingWork, verdicts }) {
		yield* assertReady(["1_record_first"]);

		yield* outcomes({
			"pending work": [pendingWork(["1_record_first"]), { components: [], migrations: [{ id: 1, name: "record_first" }] }],
			verdicts: [verdicts(), [`${NOT_CURRENT}: migration 1 (record_first). Run the deployment migration command.`]],
		});
	},
);

migrationRuns.it("a database failure during readiness stays a typed SQL error", [ledgerLacksNameColumn()], function* ({ assertReady }) {
	const verdict = yield* assertReady(["1_record_first"]);

	expect(verdict).toBe("failed with a SQL syntax error (SQLSTATE 42703)");
});
