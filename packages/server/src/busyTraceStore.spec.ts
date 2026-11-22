import { Effect } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { localTraces } from "#test/localTraces.ts";

localTraces.it(
	"a recorder whose store another writer keeps holding drops its batches, warns once and still closes",
	[],
	function* ({ anotherWriterHoldsStore, loggedWarnings, open, read, flushPassesWhileStoreStaysHeld }) {
		const recorder = yield* open();
		yield* anotherWriterHoldsStore();
		yield* recorder.record("first");
		yield* flushPassesWhileStoreStaysHeld();
		yield* recorder.record("second");

		const shutdown = yield* recorder.closeWhileStoreStaysHeld();

		yield* outcomes([
			["shutdown", () => Effect.succeed(shutdown), "closed"],
			[
				"warnings",
				() => loggedWarnings(),
				[expect.stringMatching(/another writer held \S+traces\.db for over a second, so 2 spans were not recorded/u)],
			],
			["recorded spans", () => read().pipe(Effect.map(({ spans }) => spans)), []],
		]);
	},
);

localTraces.it(
	"a recorder that closes while another writer briefly holds the store records its spans once the writer lets go",
	[],
	function* ({ anotherWriterHoldsStore, loggedWarnings, open, read }) {
		const recorder = yield* open();
		yield* anotherWriterHoldsStore();
		yield* recorder.record();

		const shutdown = yield* recorder.closeAsStoreFrees();

		yield* outcomes([
			["shutdown", () => Effect.succeed(shutdown), "closed"],
			["recorded spans", () => read().pipe(Effect.map(({ spans }) => spans.map((row) => row.name))), ["effect.log", "checkout"]],
			["warnings", () => loggedWarnings(), []],
		]);
	},
);

localTraces.it(
	"a write that fails for another reason than a held store still fails the recorder's close",
	[],
	function* ({ anotherWriterDropsSpansTable, open }) {
		const recorder = yield* open();
		yield* recorder.record();
		yield* anotherWriterDropsSpansTable();

		const shutdown = yield* recorder.shutDown();

		expect(shutdown).toContain("no such table: spans");
	},
);

localTraces.it(
	"a recorder that opens while another writer keeps holding the store fails to start and names the store",
	[],
	function* ({ anotherWriterHoldsStore, open, openWhileStoreStaysHeld }) {
		yield* open();
		yield* anotherWriterHoldsStore();

		const opened = yield* openWhileStoreStaysHeld();

		expect(opened).toMatch(/Another writer holds the development trace store \S+traces\.db/u);
	},
);
