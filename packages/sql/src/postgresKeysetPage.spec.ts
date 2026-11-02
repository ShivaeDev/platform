import { Option } from "effect";
import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { keysetPages, tiedRows } from "#test/keysetPages.ts";

for (const { direction, tieDirection, expected } of [
	{ direction: "asc", expected: [1, 2, 3, 4], tieDirection: "asc" },
	{ direction: "desc", expected: [4, 3, 2, 1], tieDirection: "desc" },
	{ direction: "asc", expected: [3, 2, 1, 4], tieDirection: "desc" },
] as const) {
	keysetPages.it(
		`${direction}ending rank with ${tieDirection}ending unique id traverses tied values without repeating or skipping a row`,
		[tiedRows()],
		function* ({ readPage }) {
			const first = yield* readPage({ direction, limit: 2, tieDirection });

			const second = yield* readPage({ after: Option.getOrThrow(first.next), direction, limit: 2, tieDirection });

			expect([...first.rows, ...second.rows].map((row) => row.id)).toEqual(expected);
			expect(second.next).toEqual(Option.none());
		},
	);
}

for (const { direction, expected, cursorAt } of [
	{ cursorAt: "2026-01-01T00:00:00.123002+00:00", direction: "asc", expected: [2, 1, 3, 4] },
	{ cursorAt: "2026-01-01T00:00:00.123002+00:00", direction: "desc", expected: [4, 3, 1, 2] },
] as const) {
	keysetPages.it(
		`${direction}ending timestamps keep microseconds across a tied page boundary while result dates use milliseconds`,
		[tiedRows()],
		function* ({ readPage }) {
			const first = yield* readPage({ direction, limit: 2, sort: "time" });
			const cursor = Option.getOrThrow(first.next);
			expect(cursor.at).toBe(cursorAt);
			expect(first.rows.at(-1)?.seenAt.toISOString()).toBe("2026-01-01T00:00:00.123Z");

			const second = yield* readPage({ after: cursor, direction, limit: 2, sort: "time" });

			expect([...first.rows, ...second.rows].map((row) => row.id)).toEqual(expected);
			expect(second.next).toEqual(Option.none());
		},
	);
}

keysetPages.it("multiple sort columns seek past equal prefixes before the unique id", [tiedRows()], function* ({ readPage }) {
	const first = yield* readPage({ limit: 2, sort: "rankAndTime" });

	const second = yield* readPage({ after: Option.getOrThrow(first.next), limit: 2, sort: "rankAndTime" });

	expect([...first.rows, ...second.rows].map((row) => row.id)).toEqual([2, 1, 3, 4]);
});

keysetPages.it("single-row pages ordered by a unique id alone traverse every row", [tiedRows()], function* ({ readPage }) {
	const first = yield* readPage({ limit: 1, sort: "id" });

	const second = yield* readPage({ after: Option.getOrThrow(first.next), limit: 1, sort: "id" });
	const third = yield* readPage({ after: Option.getOrThrow(second.next), limit: 1, sort: "id" });
	const fourth = yield* readPage({ after: Option.getOrThrow(third.next), limit: 1, sort: "id" });

	expect([...first.rows, ...second.rows, ...third.rows, ...fourth.rows].map((row) => row.id)).toEqual([1, 2, 3, 4]);
	expect(fourth.next).toEqual(Option.none());
});

keysetPages.it("one lookahead row determines continuation in one query and is excluded from the page", [tiedRows()], function* (page) {
	const first = yield* page.readPage({ limit: 2 });

	expect(first.rows.map((row) => row.id)).toEqual([1, 2]);
	expect(Option.getOrThrow(first.next)).toMatchObject({ id: 2 });
	yield* outcomes([
		["statements sent", () => page.statementsSent(), 1],
		["rows fetched by that statement", () => page.rowsFetched(), [1, 2, 3]],
	]);
});

keysetPages.it("the caller's owner predicate and numeric result decoder apply to every page", [tiedRows()], function* ({ readPage }) {
	const first = yield* readPage({ limit: 3 });

	const second = yield* readPage({ after: Option.getOrThrow(first.next), limit: 3 });

	expect([...first.rows, ...second.rows].map(({ id, rank }) => ({ id, rank }))).toEqual([
		{ id: 1, rank: 1 },
		{ id: 2, rank: 1 },
		{ id: 3, rank: 1 },
		{ id: 4, rank: 2 },
	]);
	expect(second.next).toEqual(Option.none());
});

keysetPages.it("an empty query returns no continuation", [], function* ({ readPage }) {
	const page = yield* readPage({ limit: 2 });

	expect(page).toEqual({ next: Option.none(), rows: [] });
});

for (const limit of [0, -1, 1.5, Number.NaN, Number.POSITIVE_INFINITY]) {
	keysetPages.it(`page size ${limit} fails validation before the caller sends SQL`, [tiedRows()], function* ({ attemptPage, statementsSent }) {
		const result = yield* attemptPage(limit);

		expect(result).toBe("failed with a schema error");
		expect(yield* statementsSent()).toBe(0);
	});
}
