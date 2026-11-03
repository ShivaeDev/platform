import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { events, saved, unprojectableHistory } from "#test/kit.ts";

events.it(
	"an unchanged observation succeeds without growing history, writing projections or publishing change keys",
	[saved("initial", "Original")],
	function* ({ announcedChanges, history, observeName, storedRows, watchChanges }) {
		yield* watchChanges();
		yield* outcomes([
			["history before", () => history(), [{ name: "Original" }]],
			["rows before", () => storedRows(), [{ name: "Original", stream: "alice" }]],
		]);

		const result = yield* observeName("unchanged", "Original");

		expect(result).toEqual({ name: "Original", version: 1 });
		yield* outcomes([
			["history after", () => history(), [{ name: "Original" }]],
			["rows after", () => storedRows(), [{ name: "Original", stream: "alice" }]],
			["announced changes", () => announcedChanges(), []],
		]);
	},
);

events.it(
	"retrying an unchanged request after a changed observation returns its original result and version without changing the newer state",
	[saved("initial", "Original")],
	function* ({ announcedChanges, history, observeName, storedRows, watchChanges }) {
		const original = yield* observeName("unchanged", "Original");
		yield* observeName("changed", "Newer");
		yield* watchChanges();

		const repeated = yield* observeName("unchanged", "Original");

		expect(original).toEqual({ name: "Original", version: 1 });
		expect(repeated).toEqual(original);
		yield* outcomes([
			["history", () => history(), [{ name: "Original" }, { name: "Newer" }]],
			[
				"projected rows",
				() => storedRows(),
				[
					{ name: "Original", stream: "alice" },
					{ name: "Newer", stream: "alice" },
				],
			],
			["announced changes", () => announcedChanges(), []],
		]);
	},
);

events.it(
	"a changed observation advances the version, appends its event, projects it and publishes change keys",
	[saved("initial", "Original")],
	function* ({ announcedChanges, history, observeName, storedRows, watchChanges }) {
		yield* watchChanges();

		const result = yield* observeName("changed", "Newer");

		expect(result).toEqual({ name: "Newer", version: 2 });
		yield* outcomes([
			["history", () => history(), [{ name: "Original" }, { name: "Newer" }]],
			[
				"projected rows",
				() => storedRows(),
				[
					{ name: "Original", stream: "alice" },
					{ name: "Newer", stream: "alice" },
				],
			],
			["announced changes", () => announcedChanges(), ["notes"]],
		]);
	},
);

events.it(
	"an unchanged observation leaves pending projection work untouched",
	[saved("initial", "Original"), unprojectableHistory],
	function* ({ history, observeName, storedRows }) {
		const result = yield* observeName("unchanged", "Rejected");

		expect(result).toEqual({ name: "Rejected", version: 2 });
		yield* outcomes([
			["history", () => history(), [{ name: "Original" }, { name: "Rejected" }]],
			["projected rows", () => storedRows(), [{ name: "Original", stream: "alice" }]],
		]);
	},
);

events.it(
	"an empty batch at version zero records a receipt recognised by a later append",
	[],
	function* ({ append, appendEmpty, history, storedRows }) {
		const recorded = yield* appendEmpty("unchanged");

		const repeated = yield* append("unchanged", ["Repeated"]);

		expect(recorded).toBe(0);
		expect(repeated).toBe("already done");
		yield* outcomes([
			["history", () => history(), []],
			["projected rows", () => storedRows(), []],
		]);
	},
);

events.it(
	"a stale empty batch conflicts without claiming its request id, allowing a corrected retry",
	[saved("initial", "Original")],
	function* ({ append, history }) {
		const stale = yield* append("unchanged", [], 0);

		const corrected = yield* append("unchanged", [], 1);
		const repeated = yield* append("unchanged", ["Repeated"], 1);

		expect(stale).toBe("conflict at 1, expected 0");
		expect(corrected).toBe("appended");
		expect(repeated).toBe("already done");
		expect(yield* history()).toEqual([{ name: "Original" }]);
	},
);
