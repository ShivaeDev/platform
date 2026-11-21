import { expect } from "vitest";
import { outcomes } from "@shivaedev/test-story/server/outcomes.ts";
import {
	aliceOpens,
	aliceOpensRoute,
	aliceReloadsWithStoredResults,
	aliceSeesFirstResults,
	firstSettledScreens,
	visitorOpensSignedOutPage,
} from "#test/first-settled/story.tsx";

const WAITING = "waiting for first results";
const SETTLED = "first results settled";

firstSettledScreens.it(
	"useFirstSettled stays false until every query on alice's first screen has answered",
	[aliceOpens()],
	function* ({ answers, signal }) {
		expect(yield* signal()).toBe(WAITING);
		yield* answers("title", "Groceries");
		expect(yield* signal()).toBe(WAITING);

		yield* answers("author", "alice");

		expect(yield* signal()).toBe(SETTLED);
	},
);

firstSettledScreens.it(
	"once true, useFirstSettled stays true while a later command is in flight and a later query awaits its first result",
	[aliceSeesFirstResults],
	function* ({ activity, showCount, signal, startRename }) {
		expect(yield* signal()).toBe(SETTLED);

		yield* startRename();
		yield* showCount();

		yield* outcomes([
			["client activity", () => activity(), { commands: 1, initialQueries: 1 }],
			["signal", () => signal(), SETTLED],
		]);
	},
);

firstSettledScreens.it(
	"a new session generation starts with useFirstSettled false and turns it true with its own first results",
	[aliceSeesFirstResults],
	function* ({ answers, signal, signIn }) {
		expect(yield* signal()).toBe(SETTLED);

		yield* signIn("bob");

		expect(yield* signal()).toBe(WAITING);
		yield* answers("title", "Errands");
		yield* answers("author", "bob");
		expect(yield* signal()).toBe(SETTLED);
	},
);

firstSettledScreens.it(
	"a screen that reads no query turns useFirstSettled true once it has rendered, and a later command does not turn it back",
	[aliceOpens("no query")],
	function* ({ command, signal, startRename }) {
		expect(yield* signal()).toBe(SETTLED);

		yield* startRename();

		yield* outcomes([
			["command", () => command(), "unfinished"],
			["signal", () => signal(), SETTLED],
		]);
	},
);

firstSettledScreens.it(
	"first results that arrive while a command is in flight turn useFirstSettled true only when the command finishes",
	[aliceOpens()],
	function* ({ answers, renameFinishes, signal, startRename }) {
		yield* startRename();
		yield* answers("title", "Groceries");
		yield* answers("author", "alice");
		expect(yield* signal()).toBe(WAITING);

		yield* renameFinishes();

		expect(yield* signal()).toBe(SETTLED);
	},
);

firstSettledScreens.it(
	"a warm query that no screen reads does not hold back useFirstSettled while it waits for its first result",
	[aliceOpens("title and author", "count")],
	function* ({ activity, answers, signal }) {
		yield* answers("title", "Groceries");

		yield* answers("author", "alice");

		yield* outcomes([
			["client activity", () => activity(), { commands: 0, initialQueries: 1 }],
			["signal", () => signal(), SETTLED],
		]);
	},
);

firstSettledScreens.it(
	"a query the first screen mounts only after its first render shows its own loading state while useFirstSettled is already true",
	[aliceOpens("count after its first render")],
	function* ({ count, signal }) {
		yield* outcomes([
			["count", () => count(), "waiting"],
			["signal", () => signal(), SETTLED],
		]);
	},
);

firstSettledScreens.it(
	"a screen that reads no query turns useFirstSettled true while the session's warm query still waits for its first result",
	[aliceOpens("no query", "count")],
	function* ({ activity, signal }) {
		yield* outcomes([
			["client activity", () => activity(), { commands: 0, initialQueries: 1 }],
			["signal", () => signal(), SETTLED],
		]);
	},
);

firstSettledScreens.it(
	"a first screen whose queries show stored results turns useFirstSettled true while they are still stale and refreshing",
	[aliceReloadsWithStoredResults],
	function* ({ answer, signal }) {
		yield* outcomes([
			["title", () => answer("title"), "Groceries (stale, refreshing)"],
			["author", () => answer("author"), "alice (stale, refreshing)"],
			["signal", () => signal(), SETTLED],
		]);
	},
);

for (const route of ["a loader that reads the title", "a component that reads the title"] as const) {
	firstSettledScreens.it(
		`above react's RouterProvider, a first route with ${route} keeps useFirstSettled false until the title answers and then reveals it in one step`,
		[aliceOpensRoute(route)],
		function* ({ answer, answers, signal }) {
			expect(yield* signal()).toBe(WAITING);

			yield* answers("title", "Groceries");

			yield* outcomes([
				["title", () => answer("title"), "Groceries"],
				["signal", () => signal(), SETTLED],
			]);
		},
	);
}

firstSettledScreens.it(
	"in StrictMode, above react's RouterProvider, a first route with a component that reads the title keeps useFirstSettled false until the title answers",
	[aliceOpensRoute("a component that reads the title", "react's", "in StrictMode")],
	function* ({ answer, answers, signal }) {
		expect(yield* signal()).toBe(WAITING);

		yield* answers("title", "Groceries");

		yield* outcomes([
			["title", () => answer("title"), "Groceries"],
			["signal", () => signal(), SETTLED],
		]);
	},
);

firstSettledScreens.it(
	"above react's RouterProvider, a first route that reads nothing turns useFirstSettled true once it has rendered",
	[aliceOpensRoute("nothing")],
	function* ({ answer, signal }) {
		yield* outcomes([
			["route", () => answer("blank"), "blank form"],
			["signal", () => signal(), SETTLED],
		]);
	},
);

firstSettledScreens.it(
	"above TanStack's own RouterProvider, useFirstSettled turns true before the first route's title has answered",
	[aliceOpensRoute("a component that reads the title", "TanStack's")],
	function* ({ answer, signal }) {
		yield* outcomes([
			["title", () => answer("title"), "waiting"],
			["signal", () => signal(), SETTLED],
		]);
	},
);

firstSettledScreens.it(
	"react's RouterProvider shows a signed-out page's route with no session, client or useFirstSettled above it",
	[visitorOpensSignedOutPage],
	function* ({ answer }) {
		expect(yield* answer("sign-in")).toBe("sign-in form");
	},
);
