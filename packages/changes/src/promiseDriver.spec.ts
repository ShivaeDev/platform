import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { COMMIT_REFUSED } from "#test/engine.ts";
import { change } from "#test/fakeDatabase.ts";
import { callbacksReadNote, changes, hookFails, promiseCommitWaits } from "#test/kit.ts";

changes.it(
	"a Promise driver publishes ada's change only after its transaction callback and commit succeed",
	[promiseCommitWaits()],
	function* ({ startPromiseDriver, finishPromiseCommit, record, published, promiseEnding }) {
		yield* startPromiseDriver(function* () {
			yield* record(change("ada"));
			expect(yield* published()).toEqual([]);
		});
		expect(yield* published()).toEqual([]);

		yield* finishPromiseCommit();

		yield* outcomes([
			["driver outcome", () => promiseEnding(), "committed"],
			["published changes", () => published(), [["ada:orders"]]],
		]);
	},
);

changes.it(
	"a Promise driver whose commit rejects after ada's callback succeeds reports the rejection and publishes nothing",
	[promiseCommitWaits()],
	function* ({ startPromiseDriver, rejectPromiseCommit, record, published, promiseEnding }) {
		yield* startPromiseDriver(record(change("ada")));
		expect(yield* published()).toEqual([]);

		yield* rejectPromiseCommit();

		yield* outcomes([
			["driver rejection", () => promiseEnding(), COMMIT_REFUSED],
			["published changes", () => published(), []],
		]);
	},
);

changes.it(
	"ada's caller context reaches the Promise transaction body, before-commit hook and publication callback",
	[callbacksReadNote()],
	function* ({ withCallerNote, promiseDriver, record, noteCaller, callbackNotes }) {
		yield* withCallerNote(
			"ada's request",
			promiseDriver(function* () {
				yield* noteCaller();
				yield* record(change("ada"));
			}),
		);

		expect(yield* callbackNotes()).toEqual(["body: ada's request", "hook: ada's request", "sink: ada's request"]);
	},
);

changes.it(
	"a rejected Promise transaction body rejects the driver and publishes nothing",
	[],
	function* ({ promiseDriver, record, rollback, published, promiseEnding }) {
		yield* promiseDriver(function* () {
			yield* record(change("ada"));
			yield* rollback();
		});

		yield* outcomes([
			["driver rejection", () => promiseEnding(), expect.stringContaining("rejected")],
			["published changes", () => published(), []],
		]);
	},
);

changes.it(
	"a failed before-commit hook rejects the Promise driver and publishes nothing",
	[hookFails("notify failed")],
	function* ({ promiseDriver, record, published, promiseEnding }) {
		yield* promiseDriver(record(change("ada")));

		yield* outcomes([
			["driver rejection", () => promiseEnding(), expect.stringContaining("notify failed")],
			["published changes", () => published(), []],
		]);
	},
);
