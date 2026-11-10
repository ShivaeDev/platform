import { DateTime, Option } from "effect";
import { expect } from "vitest";
import { generatedOnce, generator, notesProject } from "#test/generator.ts";

const MILLISECONDS = Date.UTC(2026, 10, 10, 9, 30, 15, 123);

const BARE_STATS = {
	archived: false,
	busy: true,
	bytes: 9_007_199_254_740_993n,
	check: { ok: false, reason: "ü\u0000\n" },
	checkedAt: DateTime.makeUnsafe(MILLISECONDS),
	confirmed: true,
	count: Number.NaN,
	events: [
		{ id: 1, kind: "created" },
		{ at: new Date(MILLISECONDS), id: 2, kind: "deleted" },
	],
	frozenWords: {},
	ids: [],
	latest: null,
	level: 3,
	nothing: null,
	pair: ["", 1],
	range: [Number.POSITIVE_INFINITY, Number.NEGATIVE_INFINITY],
	status: "draft",
	unset: undefined,
	words: { "": 1, "a b": Number.POSITIVE_INFINITY },
};

const FULL_STATS = {
	...BARE_STATS,
	bytes: -18_446_744_073_709_551_616n,
	check: { count: Number.MAX_SAFE_INTEGER, ok: true },
	count: 0.1,
	events: [],
	flag: false,
	ids: [2, 1, 2],
	latest: "Plan",
	review: "open",
	reviewedAt: new Date(MILLISECONDS),
	status: "published",
	words: {},
};

const LISTED = { createdAt: new Date(MILLISECONDS), id: 1, pinned: true, tags: ["b", "a", "b"], title: "Plan" };

for (const [label, operation, sent] of [
	["stats without its optional keys", "stats", BARE_STATS],
	["stats with every optional key", "stats", FULL_STATS],
	["an empty list", "list", []],
	["a list of notes without and with a summary", "list", [LISTED, { ...LISTED, summary: "" }]],
	["no note from get", "get", Option.none()],
	["the summary struct", "summary", { id: 1, title: "Plan" }],
	["nothing from remove", "remove", undefined],
] as const) {
	generator.it(
		`${label} arrives through the generated wire equal to what run returned, with the same classes`,
		[notesProject(), generatedOnce()],
		function* ({ receives }) {
			expect(yield* receives(operation, sent)).toStrictEqual(sent);
		},
	);
}

generator.it(
	"a NoteCard from create, and one inside get's Option, arrive through the generated wire as equal NoteCard instances",
	[notesProject(), generatedOnce()],
	function* ({ noteCard, receives }) {
		const card = yield* noteCard(1, "Plan");

		expect([yield* receives("create", card), yield* receives("get", Option.some(card))]).toStrictEqual([card, Option.some(card)]);
	},
);

generator.it(
	"a count of -0 arrives through the generated wire as 0, because JSON has no -0",
	[notesProject(), generatedOnce()],
	function* ({ receives }) {
		expect(yield* receives("stats", { ...BARE_STATS, count: -0 })).toStrictEqual({ ...BARE_STATS, count: 0 });
	},
);

generator.it("an event at an invalid Date cannot be encoded by the generated wire", [notesProject(), generatedOnce()], function* ({ receives }) {
	expect(yield* receives("stats", { ...BARE_STATS, events: [{ at: new Date(Number.NaN), id: 2, kind: "deleted" }] })).toBe("cannot be encoded");
});
