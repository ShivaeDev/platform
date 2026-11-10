import { Effect } from "effect";
import { expect } from "vitest";
import { expectNoReactWarnings } from "@shivaedev/test-story/client/adapters/react.ts";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import { denied, held, initialPostgres } from "#test/initial-postgres/story.tsx";

expectNoReactWarnings();

initialPostgres.it(
	"opening a live screen displays its decoded PostgreSQL result with one request",
	[],
	function* ({ open, settled, shown, requests, reads }) {
		yield* open();
		yield* settled();

		yield* outcomes([
			["screen", () => shown(), "Visible first (bigint)"],
			["requests", () => requests(), ["opening.$changes"]],
			["query reads", () => reads(), 1],
		]);
	},
);

initialPostgres.it("a route loader receives the decoded PostgreSQL result with one request", [], function* ({ loadRoute, requests }) {
	const value = yield* loadRoute();

	yield* outcomes([
		["loader result", () => Effect.succeed(value), { revision: 1n, title: "Visible first" }],
		["requests", () => requests(), ["opening.$changes"]],
	]);
});

initialPostgres.it(
	"a screen opening its query after a route loader read it and the registry's idle window passed shows the PostgreSQL result from one request and one read",
	[],
	function* ({ idleWindowPasses, loadRoute, open, reads, requests, settled, shown }) {
		yield* loadRoute();
		yield* idleWindowPasses();

		yield* open();
		yield* settled();

		yield* outcomes([
			["screen", () => shown(), "Visible first (bigint)"],
			["requests", () => requests(), ["opening.$changes"]],
			["query reads", () => reads(), 1],
		]);
	},
);

for (const at of ["before", "after"] as const) {
	initialPostgres.it(
		`a commit ${at} the registered query's first SQL snapshot reaches the screen`,
		[held(at)],
		function* ({ open, firstReadEntered, commit, releaseRead, settled, shown }) {
			yield* open();
			yield* firstReadEntered();

			yield* commit("Visible changed");
			yield* releaseRead();
			yield* settled();

			expect(yield* shown()).toBe("Visible changed (bigint)");
		},
	);
}

initialPostgres.it(
	"a denied live screen receives no result and displays its policy denial without reading data",
	[denied],
	function* ({ open, settled, shown, results, reads }) {
		yield* open();
		yield* settled();

		yield* outcomes([
			["screen", () => shown(), "Read denied"],
			["subscription results", () => results(), []],
			["query reads", () => reads(), 0],
		]);
	},
);
